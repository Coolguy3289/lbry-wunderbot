## Bot for [LBRY's Discord](https://discord.gg/tgnNHf5)

(This README will be updated along with bot updates)

<h3>
<details><summary>Features:</summary>

* Price bot displays price of lbc for currency given.

  * _Responds to `!price <cur> <amount>`_

* Stats bot displays current market stats of lbc.

  * _Responds to `!stats`_

* Hash bot displays current hashrate of lbc network. Also Includes to calculate given MH/s to LBC & fiat per hr, day, week, month.

  * _Responds to `!hash`_

  * _Responds to `!hash power <MH/s> <fiat>`_

* AltStats bot displays current market stats of specfied currency

  * _Responds to `!altstats <coin>`_

* AltPrice bot displays current price for given coin and currency

  * _Responds to `!altprice <coin> <currency> <amount>`_

* Github Release Notes bot displays release notes for current lbry-app release.

  * _Responds to `!releasenotes`_

  * _(moderator only) `!releasenotes post` - send to release notes channel_

* Purge Bot deletes X amount of messages.

  * _(moderator only) Responds to `!purge <X>`_

* Speech bot displays top claim from provided image name(coming soon posting to speech).

  * _Responds to `!speech <imagename>`_

* Welcome bot sends Direct Message when new users join,

  * _(moderator only) Responds to `!welcome <@username>`_

* Timeout bot assigns members the timeout roll for X-minutes where they are restricted from talking

  * _(moderator only) Responds to `!timeout <@username> <Mins>`_

* Roll Setter bot allows users to assign themselves rolls

  * _Responds to `!addrole <role>` - Adds to Role_

  * _Responds to `!delrole <role>` - Deletes from Role_

  * _Responds to `!roles` - List Available Roles_

* LBRY URL Linker displays lbry:// urls as open.lbry.io links to make them clickable

* LBRY claim bot displays recent publishes on the lbry protocol

* IRC bot to connect an irc channel with discord

* Spam Detection Bot to Prevent Discord Raids and Spammers

* Dynamic plugin loading with permission support.

</details>
</h3>

---

### Requirements

* node > 8.0.0
* npm > 0.12.x
* yarn ( install with npm install -g yarn if not installed )

---

### Installation

Create a bot and get the bot's API Token: https://discordapp.com/developers/applications/me

Edit and rename default.json.example in /config, then cd to wunderbot directory and run:

```
yarn install
node bot/bot.js
```

---

### Development

Be sure to run the command below before working on any code, this ensures prettier goes to work and keeps code to our standard.

```
yarn install --production=false
```

to run prettier before submitting your code simply run the following in the bots root directory.

```
yarn precommit
```
