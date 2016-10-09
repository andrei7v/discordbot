/**
 * Created by julia on 10.07.2016.
 */
var fs = require('fs');
var ytdl = require('ytdl-core');
var queueModel = require('../DB/queue');
var songModel = require('../DB/song');
var serverModel = require('../DB/server');
var path = require('path');
var general = require('./general');
var request = require('request');
var dispatcherArray = [];
var errorReporter = require('./errorReporter');
var client = errorReporter.getT();
var shortid = require('shortid');
var saveVoiceChannel = function saveVoiceChannel(channel) {
    return new Promise((resolve, reject) => {
        serverModel.findOne({id: channel.guild.id}, function (err, Server) {
            if (err) {
                reject('error!!!');
            }
            if (Server) {
                Server.updateVoice(channel.id, function (err) {
                    if (err) {
                        reject('Internal Error');
                    }
                    resolve();
                });
            } else {
                var server = new serverModel({
                    id: channel.guild.id,
                    lastVoiceChannel: channel.id,
                    nsfwChannels: [],
                    cmdChannels: [],
                    permissions: [],
                    prefix: "!w",
                    disabledCmds: [],
                    Groups: [],
                    Blacklist: []
                });
                server.save(err => {
                    if (err) reject('Internal Error');
                    resolve();
                });
            }
        });
    });
};
var clearLastVoice = function clearLastVoice(message) {
    return new Promise((resolve, reject) => {
        serverModel.findOne({id: message.guild.id}, function (err, Server) {
            if (err) {
                reject('Internal Error');
            }
            if (Server) {
                Server.updateVoice("", function (err) {
                    if (err) {
                        reject('Internal Error');
                    }
                    resolve();
                });
            } else {
                var server = new serverModel({
                    id: message.guild.id,
                    lastVoiceChannel: "",
                    nsfwChannels: [],
                    cmdChannels: [],
                    permissions: [],
                    prefix: "!w.",
                    disabledCmds: [],
                    Groups: [],
                    Blacklist: []
                });
                server.save(err => {
                    if (err) reject('Internal Error');
                    resolve();
                });
            }
        });
    });
};
var loadLastVoice = function loadLastVoice(guild) {
    return new Promise((resolve, reject) => {
        if (typeof(guild) !== 'undefined' && typeof(guild.id) !== 'undefined' && guild) {
            serverModel.findOne({id: guild.id}, function (err, Server) {
                if (err) reject(err);
                if (Server) {
                    if (typeof(Server.lastVoiceChannel) !== 'undefined' && Server.lastVoiceChannel !== '') {
                        resolve(Server.lastVoiceChannel);
                    } else {
                        resolve();
                    }
                } else {
                    if (typeof(guild) !== 'undefined' && typeof(guild.id) !== 'undefined' && guild) {
                        var server = new serverModel({
                            id: guild.id,
                            lastVoiceChannel: "",
                            nsfwChannels: [],
                            cmdChannels: [],
                            permissions: [],
                            prefix: "!w.",
                            disabledCmds: [],
                            Groups: [],
                            Blacklist: []
                        });
                        server.save(err => {
                            if (err) reject('Internal Error');
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                }
            });
        } else {
            resolve();
        }
    });
};
var joinVoiceChannel = function joinVoiceChannel(channel) {
    return new Promise((resolve,reject) => {
        channel.join().then(resolve).catch(reject);
    });
};
var inVoiceChannel = function inVoiceChannel(message) {
    return message.guild.voiceConnection;
};
var getVoiceConnection = function getVoiceConnection(message) {
    return message.guild.voiceConnection
};
var getVoiceConnectionServer = function getVoiceConnectionServer(guild) {
    return guild.voiceConnection;
};
var getVoiceChannel = function getVoiceChannel(message) {
    if (message.guild.voiceConnection) {
        var conn = message.guild.voiceConnection;
        return conn.channel;
    }
    return null;
};
var getChannelFromId = function getChannelFromId(guild, id) {
    if (!!guild.channels.get(id)) {
        return guild.channels.get(id);
    }
    return null;
};
var nextSong = function nextSong(message, Song) {
    if (inVoiceChannel(message)) {
        let connectionVoice = getVoiceConnection(message);
        let dispatcher = getDispatcherFromConnection(connectionVoice);
        queueModel.findOne({server: message.guild.id}, function (err, Queue) {
            if (err) return console.log(err);
            if (Queue) {
                if (Queue.songs.length > 0) {
                    if (typeof (Queue.repeat) !== 'undefined' && typeof (Queue.repeatId) !== 'undefined' && Queue.repeat && Song.id === Queue.repeatId) {
                        playSong(message, Song, true);
                    } else if (typeof (Queue.repeat) !== 'undefined' && typeof (Queue.repeatId) !== 'undefined' && Queue.repeat === false) {
                        {
                            Queue.stopRepeat(function (err) {
                                if (err) return console.log(err);
                                if (Queue.songs[0].id === Song.id) {
                                    queueModel.update({_id: Queue._id}, {$pop: {songs: -1}}, function (err) {
                                        if (err) return console.log(err);
                                        queueModel.findOne({_id: Queue._id}, function (err, Queue) {
                                            if (err) return console.log(err);
                                            if (Queue.songs.length > 0) {
                                                Queue.resetVotes(function (err) {
                                                    if (err) return console.log(err);
                                                    playSong(message, Queue.songs[0], true);
                                                });
                                            } else {
                                                Queue.resetVotes();
                                                dispatcher.end();
                                            }
                                        });
                                    });
                                }
                            });
                        }
                    } else {
                        if (Queue.songs[0].id === Song.id) {
                            queueModel.update({_id: Queue._id}, {$pop: {songs: -1}}, function (err) {
                                if (err) return console.log(err);
                                queueModel.findOne({_id: Queue._id}, function (err, Queue) {
                                    if (err) return console.log(err);
                                    if (Queue.songs.length > 0) {
                                        Queue.resetVotes(function (err) {
                                            if (err) return console.log(err);
                                            playSong(message, Queue.songs[0], true);
                                        });
                                    } else {
                                        Queue.resetVotes();
                                        try {
                                            dispatcher.end();
                                        } catch (e) {

                                        }
                                    }
                                });
                            });
                        }
                    }
                } else {
                    Queue.resetVotes();
                    dispatcher.end();
                }
            } else {

            }
        });
    }
};
var addSongFirst = function addSongFirst(message, Song, repeat) {
    return new Promise((resolve,reject) => {
        queueModel.findOne({server: message.guild.id}, function (err, Queue) {
            if (err) return cb(err);
            var Songs = [];
            Song.user = {};
            Song.user.id = message.author.id;
            Song.user.name = message.author.username;
            Songs.push(Song);
            if (Queue) {
                if (typeof(repeat) !== 'undefined' && repeat) {
                    Queue.startRepeat(function (err) {
                        if (err) reject('Internal Error');
                    });
                    Queue.updateRepeatId(Song.id, function (err) {
                        if (err) reject('Internal Error');
                    });
                } else {
                    Queue.stopRepeat(function (err) {
                        if (err) reject('Internal Error');
                    });
                    Queue.updateRepeatId("", function (err) {
                        if (err) reject('Internal Error');
                    });
                }
                if (Queue.songs.length !== 0) {
                    //i hate this stuff
                    queueModel.update({_id: Queue._id}, {$pull: {songs: {id: Song.id}}}, function (err) {
                        if (err) reject('Internal Error');
                        queueModel.update({_id: Queue._id}, {$push: {songs: {$each: Songs, $position: 0}}}, function (err) {
                            if (err) reject('Internal Error');
                            resolve();
                        });
                    });
                } else {
                    queueModel.update({_id: Queue._id}, {$push: {songs: {$each: Songs, $position: 0}}}, function (err) {
                        if (err) reject('Internal Error');
                        resolve();
                    });
                }
            } else {
                var queue;
                if (typeof(repeat) !== 'undefined' && repeat) {
                    queue = new queueModel({
                        server: message.guild.id,
                        voteSkip: 0,
                        repeat: true,
                        repeatId: Song.id,
                        songs: Songs
                    });
                } else {
                    queue = new queueModel({
                        server: message.guild.id,
                        voteSkip: 0,
                        repeat: false,
                        songs: Songs
                    });
                }
                queue.save(err => {
                    if (err) reject('Internal Error');
                    resolve();
                });
            }
        });
    });
};
var updateDispatcherArray = function (guild_id, dispatcher) {
    for (var i = 0; i < dispatcherArray.length; i++) {
        if (dispatcherArray[i].guild_id === guild_id) {
            dispatcherArray[i].dispatcher = dispatcher;
            return;
        }
    }
    dispatcherArray.push({guild_id: guild_id, dispatcher: dispatcher})
};
var playSong = function (message, Song, Queueused) {
    var connection = message.guild.voiceConnection;
    if (connection) {
        let dispatcher = connection.playFile(path.resolve(Song.path), {volume: 0.25});
        updateDispatcherArray(message.guild.id, dispatcher);
        console.log(path.resolve(Song.path));
        updatePlays(Song.id).then(() => {

        }).catch(err => {client.captureMessage(`Error at Update Plays in Play Song: ${err}`)});
        if (typeof(Queueused) === 'undefined') {
            message.channel.sendMessage("Now playing Song: " + Song.title);
        }
        dispatcher.on("end", function () {
            console.log("File ended!");
            nextSong(message, Song);
        });
        dispatcher.on("debug", information => {
            console.log(`Debug: ${information}`);
        });
        dispatcher.on("error", function (err) {
            // console.log(`Error: ${err}`);
        });
    } else {
        // client.captureMessage(`No connection found for Guild ${message.guild.name}`, {
        //     extra: {'Guild': message.guild.id},
        //     'voiceConnection': message.guild.voiceConnection
        // });
    }
};
// var streamSong = function (message, messageSplit) {
//     var connection = getVoiceConnection(message);
//     if (!connection.playing) {
//         try {
//             connection.resume();
//         } catch (e) {
//
//         }
//     }
//     var stream;
//     request('http://listen.technobase.fm/tunein-mp3-pls').pipe(stream);
// connection.stopPlaying();
// connection.playRawStream(stream, {volume: 0.25}).then(function (intent) {
// updatePlays(Song.id, function (err) {
//     if (err) return console.log(err);
// });
// if (typeof(Queueused) === 'undefined') {
// message.channel.sendMessage("Now playing Song: " + Song.title);
// }
// intent.on("end", function () {
//     console.log("File ended!");
// nextSong(message, Song);
//         });
//         intent.on("error", function (err) {
//             console.log(err);
//         });
//     }).catch(function (err) {
//         console.log(err);
//     });
// };
var startQueue = function (message) {
    queueModel.findOne({server: message.guild.id}, function (err, Queue) {
        if (err) return console.log(err);
        if (Queue) {
            Queue.stopRepeat(function (err) {
                if (err) return client.captureMessage(`Error at stop Repeat in start Queue: ${err}`, {extra: {'Guild': message.guild.id}});
                if (Queue.songs.length > 0) {
                    Queue.resetVotes(function (err) {
                        if (err) return client.captureMessage(`Error at reset Votes in start Queue: ${err}`, {extra: {'Guild': message.guild.id}});
                        playSong(message, Queue.songs[0], true);
                    });
                } else {

                }
            });
        }
    });
};
var autoStartQueue = function (message) {
    queueModel.findOne({server: message.guild.id}, function (err, Queue) {
        if (err) return console.log(err);
        if (Queue) {
            Queue.stopRepeat(function (err) {
                if (err) return client.captureMessage(`Error at stopRepeat in autoStartQueue: ${err}`, {extra: {'Guild': message.guild.id}});
                if (Queue.songs.length > 0) {
                    Queue.resetVotes(function (err) {
                        if (err) return client.captureMessage(`Error at resetVotes in autoStartQueue: ${err}`, {extra: {'Guild': message.guild.id}});
                        playSong(message, Queue.songs[0], true);
                    });
                } else {

                }
            });
        }
    });
};
var addToQueue = function (message, Song, reply) {
    return new Promise((resolve, reject) => {
        if (message.guild.available && message.guild.id) {
            queueModel.findOne({server: message.guild.id}, function (err, Queue) {
                if (err) reject('Internal Error');
                var connection = getVoiceConnection(message);
                Song.user = {};
                Song.user.id = message.author.id;
                Song.user.name = message.author.username;
                if (Queue) {
                    Queue.stopRepeat(function (err) {
                        if (err) reject('Internal Error');
                        if (Queue.songs.length === 0) {
                            if (connection) {
                                playSong(message, Song);
                                resolve("Successfully added " + Song.title + " to the Queue!");
                            }
                        }
                        for (var i = 0; i < Queue.songs.length; i++) {
                            if (Queue.songs[i].id === Song.id) {
                                reject(Song.title + " is already in the Queue!");
                                break;
                            }
                        }
                        queueModel.update({_id: Queue._id}, {$addToSet: {songs: Song}}, function (err) {
                            if (err) reject('Internal Error');
                            if (typeof (reply) === 'undefined') {
                                resolve("Successfully added " + Song.title + " to the Queue!");
                            } else {
                                resolve("");
                            }
                        });
                    });
                } else {
                    var queue = new queueModel({
                        server: message.guild.id,
                        songs: [Song],
                        repeat: false,
                        repeatId: ""
                    });
                    queue.save(function (err) {
                        if (err) reject('Internal Error');
                        if (connection) {
                            playSong(message, Song);
                        }
                        resolve("Successfully added " + Song.title + " to the Queue!");
                    });
                }
            });
        } else {
            reject('Seems like an error occured, please try again.');
        }
    });
};
var nowPlaying = function (message) {
    queueModel.findOne({server: message.guild.id}, function (err, Queue) {
        if (err) return console.log(err);
        if (Queue) {
            if (Queue.songs.length === 0) {
                message.channel.sendMessage('Nothing is playing right now...');
            } else {
                if (inVoiceChannel(message)) {
                    let dispatcher = getDispatcherFromConnection(message.guild.voiceConnection);
                    let time = Math.floor(dispatcher.time / 1000);
                    let repeat = Queue.repeat ? "repeat:on" : "";
                    if (typeof (Queue.songs[0].duration) !== 'undefined' && Queue.songs[0].duration !== '') {
                        message.channel.sendMessage(`Currently Playing: \`${Queue.songs[0].title} ${repeat} ${general.convertSeconds(time)}/${Queue.songs[0].duration} \``);
                    } else {
                        message.channel.sendMessage(`Currently Playing: \`${Queue.songs[0].title} ${repeat}\``);
                    }
                } else {
                    message.channel.sendMessage('Nothing is playing right now...');
                }
            }
        } else {
            var queue = new queueModel({
                server: message.guild.id,
                songs: []
            });
            queue.save(function (err) {
                if (err) return console.log(err);
                message.channel.sendMessage('Nothing is playing right now...');
            });
        }
    });
};
var setVolume = function (message) {
    return new Promise((resolve, reject) => {
        var messageSplit = message.content.split(' ');
        if (inVoiceChannel(message)) {
            var connection = getVoiceConnection(message);
            var dispatcher = getDispatcherFromConnection(connection);
            if (typeof (messageSplit[1]) !== 'undefined') {
                try {
                    var volume = parseInt(messageSplit[1]) / 100;
                } catch (e) {
                    return reject('Please input a Number!');
                }
                try {
                    dispatcher.setVolume(volume);
                } catch (e) {
                    console.log(e);
                    return reject('Error while setting Volume!');
                }
                resolve('Set Volume to ' + volume * 100);
            } else {
                return reject('No Volume set!');
            }
        } else {
            return reject('No Voice Connection on this Server at the Moment.');
        }
    });
};
var updatePlays = function updatePlays(id, cb) {
    return new Promise((resolve, reject) => {
        songModel.update({id: id}, {$inc: {plays: 1}}, err => {
            if (err) reject();
            resolve();
        });
    });
};
var checkMedia = function checkMedia(link) {
    var SoundcloudReg = /(?:http?s?:\/\/)?(?:www\.)?(?:soundcloud\.com|snd\.sc)\/(?:.*)/g;
    var YoutubeReg = /(?:http?s?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]+)(&.*|)/g;
    if (YoutubeReg.test(link)) {
        return true;
    } else if (SoundcloudReg.test(link)) {
        return true;
    } else {
        return false;
    }
};
var getDispatcherFromConnection = function (connection) {
    if (connection) {
        for (var i = 0; i < dispatcherArray.length; i++) {
            if (dispatcherArray[i].dispatcher.player.connection.channel.id === connection.channel.id) {
                return dispatcherArray[i].dispatcher;
            }
        }
    }
    return false;
};
var queueAddRepeat = function (message, Song) {
    queueModel.findOne({server: message.guild.id}, (err, Queue) => {
        if (err) return console.log(err);
        if (Queue && Queue.songs.length > 0 && Queue.songs[0].id === Song.id) {
            Queue.startRepeat((err => {
                if (err) return console.log(err);
                Queue.updateRepeatId(Song.id, err => {
                    if (err) return console.log(err);
                    message.reply(`Started repeat for song ${Song.title}`);
                });
            }));
        } else {
            addSongFirst(message, Song, true).then(() => {
                playSong(message, Song);
            }).catch(console.log);
        }
    });
};
module.exports = {
    inVoice: inVoiceChannel,
    saveVoice: saveVoiceChannel,
    loadVoice: loadLastVoice,
    clearVoice: clearLastVoice,
    joinVoice: joinVoiceChannel,
    nextSong: nextSong,
    playSong: playSong,
    now: nowPlaying,
    getVoiceConnection: getVoiceConnection,
    getVoiceConnectionByServer: getVoiceConnectionServer,
    getVoiceChannel: getVoiceChannel,
    getChannelById: getChannelFromId,
    addSongFirst: addSongFirst,
    startQueue: startQueue,
    autoStartQueue: autoStartQueue,
    addToQueue: addToQueue,
    updatePlays: updatePlays,
    setVolume: setVolume,
    checkMedia: checkMedia,
    getDispatcher: getDispatcherFromConnection,
    queueAddRepeat: queueAddRepeat
};