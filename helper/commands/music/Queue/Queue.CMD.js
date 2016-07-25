/**
 * Created by julian on 16.05.2016.
 */
var show = require('./show');
var add = require('./add');
var remove = require('./remove');
var QueueCmd = function QueueCmd(bot,message,messageSplit) {
    if (!message.channel.isPrivate) {
        if (typeof (messageSplit[1]) !== 'undefined') {
            if (messageSplit[1] === 'add') {
                add(bot,message,messageSplit);
            }
            if (messageSplit[1] === 'remove') {
                var admin = false;
                for (var role of message.server.rolesOfUser(message.author)) {
                    if (role.name === 'WolkeBot') {
                        admin = true;
                    }
                    if (role.name === 'Proxerteam') {
                        admin = true;
                    }
                }
                if (message.server.id === '118689714319392769' && admin || message.server.id === "166242205038673920" && admin || message.server.id !== "166242205038673920" && message.server.id !== '118689714319392769') {
                    remove(bot, message, messageSplit);
                } else {
                    bot.reply(message, 'No Permission!');
                }
            }
        } else {
            show(bot,message);
        }
    } else {
        bot.reply(message, 'This Command does not work in private Channels');
    }
};
module.exports = QueueCmd;