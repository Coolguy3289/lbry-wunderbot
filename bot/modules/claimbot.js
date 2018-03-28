"use strict";

let lbry;
let mongo;
let discordBot;
let moment = require("moment");
let request = require("request");
let sleep = require("sleep");
let config = require("config");
let channels = config.get("claimbot").channels;
const Discord = require("discord.js");

module.exports = {
  init: init
};

function init(discordBot_) {
  if (lbry) {
    throw new Error("init was already called once");
  }

  discordBot = discordBot_;

  const MongoClient = require("mongodb").MongoClient;
  MongoClient.connect(config.get("mongodb").url, function(err, db) {
    if (err) {
      throw err;
    }
    mongo = db;

    const bitcoin = require("bitcoin");
    lbry = new bitcoin.Client(config.get("lbrycrd"));

    console.log("Activating claimbot ");
    discordBot.channels.get(channels[0]).send("activating claimbot");

    setInterval(function() {
      announceNewClaims();
    }, 60 * 1000);
    announceNewClaims();
  });
}

function announceNewClaims() {
  if (!mongo) {
    discordPost("Failed to connect to mongo", {});
    return;
  }

  if (!lbry) {
    discordPost("Failed to connect to lbrycrd", {});
    return;
  }

  Promise.all([getLastBlock(), lbryCall("getinfo")])
    .then(function([lastProcessedBlock, currentBlockInfo]) {
      const currentHeight = currentBlockInfo["blocks"];
      console.log(currentHeight);
      if (lastProcessedBlock === null) {
        console.log(
          "First run. Setting last processed block to " +
            currentHeight +
            " and exiting."
        );
        return setLastBlock(currentHeight);
      }

      const testBlock = false;

      if (testBlock || lastProcessedBlock < currentHeight) {
        const firstBlockToProcess = testBlock || lastProcessedBlock + 1,
          lastBlockToProcess = testBlock || currentHeight;

        console.log(
          "Doing blocks " + firstBlockToProcess + " to " + lastBlockToProcess
        );
        return announceClaimsLoop(
          firstBlockToProcess,
          lastBlockToProcess,
          currentHeight
        );
      }
    })
    .catch(function(err) {
      discordPost(err.stack, {});
    });
}

function announceClaimsLoop(block, lastBlock, currentHeight) {
  let claimsFound = 0;
  return lbryCall("getblockhash", block)
    .then(function(blockHash) {
      return lbryCall("getblock", blockHash);
    })
    .then(function(blockData) {
      return Promise.all(blockData["tx"].map(getClaimsForTxid));
    })
    .then(function(arrayOfClaimArrays) {
      const claims = Array.prototype
        .concat(...arrayOfClaimArrays)
        .filter(function(c) {
          return !!c;
        });
      console.log("Found " + claims.length + " claims in " + block);
      claimsFound = claims.length;
      return Promise.all(
        claims.map(function(claim) {
          //the API has a rate limit. to avoid hitting it we must have a small delay between each message
          //if claims were found in this block, then we wait, otherwise we don't
          if (claimsFound > 0 && claim.hasOwnProperty("claimId"))
            sleep.msleep(300);
          return announceClaim(claim, block, currentHeight);
        })
      );
    })
    .then(function() {
      return setLastBlock(block);
    })
    .then(function() {
      const nextBlock = block + 1;
      if (nextBlock <= lastBlock) {
        return announceClaimsLoop(nextBlock, lastBlock, currentHeight);
      }
    });
}

function announceClaim(claim, claimBlockHeight, currentHeight) {
  console.log("" + claimBlockHeight + ": New claim for " + claim["name"]);
  console.log(claim);

  //ignore supports for now
  //the issue with supports is that they should be treated completely differently
  //they are not new claims...
  if (claim.hasOwnProperty("supported claimId")) return;

  let options = {
    method: "GET",
    url: "http://127.0.0.1:5000/claim_decode/" + claim["name"]
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2));
      let claimData = null;
      let channelName = null;
      try {
        body = JSON.parse(body);
        if (
          body.hasOwnProperty("stream") &&
          body.stream.hasOwnProperty("metadata")
        ) {
          claimData = body.stream.metadata;
          channelName = body.hasOwnProperty("channel_name")
            ? body["channel_name"]
            : null;
        }
      } catch (e) {
        console.error(e);
        return;
      }

      return Promise.all([
        lbryCall("getvalueforname", claim["name"]),
        lbryCall("getclaimsforname", claim["name"])
      ]).then(function([currentWinningClaim, claimsForName]) {
        //console.log(JSON.stringify(claimData));
        let value = null;
        if (claimData !== null) value = claimData;
        else {
          try {
            value = JSON.parse(claim["value"]);
          } catch (e) {}
        }

        const text = [];

        if (value) {
          /*
          if (channelName) { 
            text.push("Channel: lbry://" + channelName);
          } 
          else
          */
          console.log(value);
          if (value["author"]) {
            text.push("author: " + value["author"]);
          }
          if (value["description"]) {
            text.push(value["description"]);
          }
          // if (value['content_type'])
          // {
          //   text.push("*Content Type:* " + value['content_type']);
          // }
          if (value["nsfw"]) {
            text.push("*Warning: Adult Content*");
          }

          //"fee":{"currency":"LBC","amount":186,"version":"_0_0_1","address":"bTGoFCakvQXvBrJg1b7FJzombFUu6iRJsk"}
          if (value["fee"]) {
            const fees = [];
            text.push(
              "Price: " +
                value["fee"].amount +
                " *" +
                value["fee"].currency +
                "*"
            );
          }

          if (!claim["is controlling"]) {
            // the following is based on https://lbry.io/faq/claimtrie-implementation
            const lastTakeoverHeight = claimsForName["nLastTakeoverHeight"],
              maxDelay = 4032, // 7 days of blocks at 2.5min per block
              activationDelay = Math.min(
                maxDelay,
                Math.floor((claimBlockHeight - lastTakeoverHeight) / 32)
              ),
              takeoverHeight = claimBlockHeight + activationDelay,
              secondsPerBlock = 161, // in theory this should be 150, but in practice its closer to 161
              takeoverTime =
                Date.now() +
                (takeoverHeight - currentHeight) * secondsPerBlock * 1000;

            text.push(
              "Takes effect on approx. **" +
                moment(takeoverTime, "x").format("MMMM Do [at] HH:mm [UTC]") +
                "** (block " +
                takeoverHeight +
                ")"
            );
          }

          const richEmbeded = {
            author: {
              name: value["author"] || "Anonymous",
              url: "http://open.lbry.io/" + claim["name"],
              icon_url:
                "http://barkpost-assets.s3.amazonaws.com/wp-content/uploads/2013/11/3dDoge.gif"
            },
            title:
              "lbry://" +
              (channelName ? channelName + "/" : "") +
              claim["name"],
            color: 1399626,
            description: escapeSlackHtml(text.join("\n")),
            footer: {
              text:
                "Block " + claimBlockHeight + " • Claim ID " + claim["claimId"]
            },
            image: { url: !value["nsfw"] ? value["thumbnail"] || "" : "" },
            url: "http://open.lbry.io/" + claim["name"]
          };

          discordPost(text, richEmbeded);
        }
      });
    } catch (e) {
      console.error(e);
    }
  });
}

function escapeSlackHtml(txt) {
  return txt
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;");
}

function getClaimsForTxid(txid) {
  return lbryCall("getclaimsfortx", txid).catch(function(err) {
    // an error here most likely means the transaction is spent,
    // which also means there are no claims worth looking at
    return [];
  });
}

function getLastBlock() {
  return new Promise(function(resolve, reject) {
    mongo.collection("claimbot").findOne({}, function(err, obj) {
      if (err) {
        reject(err);
      } else if (!obj) {
        mongo
          .collection("claimbot")
          .createIndex({ last_block: 1 }, { unique: true });
        resolve(null);
      } else {
        resolve(obj.last_block);
      }
    });
  });
}

function setLastBlock(block) {
  return new Promise(function(resolve, reject) {
    mongo
      .collection("claimbot")
      .findOneAndUpdate(
        { last_block: { $exists: true } },
        { last_block: block },
        { upsert: true, returnOriginal: false },
        function(err, obj) {
          if (!err && obj && obj.value.last_block != block) {
            reject(
              "Last value should be " +
                block +
                ", but it is " +
                obj.value.last_block
            );
          } else {
            resolve();
          }
        }
      );
  });
}

function discordPost(text, params) {
  let richEmbeded = new Discord.RichEmbed(params);

  channels.forEach(channel => {
    discordBot.channels
      .get(channel)
      .send("", richEmbeded)
      .catch(console.error);
  });
}

function lbryCall(...args) {
  return new Promise(function(resolve, reject) {
    lbry.cmd(...args, function(err, ...response) {
      if (err) {
        reject(
          new Error("JSONRPC call failed. Args: [" + args.join(", ") + "]")
        );
      } else {
        resolve(...response);
      }
    });
  });
}
