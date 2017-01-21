var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var require_tree = require('require-tree');
global.path = require('path');
global._ = require('underscore');
global.Backbone = require('backbone');
global.App = require_tree(path.dirname(require.main.filename)+"/App");

var rooms = new App.Collection.Rooms([], {model: App.Model.Room});
var allUsers = new App.Collection.Users([], {model: App.Model.User});

app.get('/', function(req, res){
  res.sendfile('index.html');
});


io.on('connection', function(socket){
	socket.emit('connected')

  socket.on('user join', function(oUser){
    var user = new App.Model.User({
      userName : oUser.userName,
      avatarId : oUser.avatarId,
      avatarBg : oUser.avatarBg,
      userStatus : oUser.userStatus,
      roomId: oUser.roomId,
      id : socket.id
    });
    var room = rooms.getOrInit(oUser.roomId);
    room.addUser(user);
    allUsers.add(user);
    socket.join(oUser.roomId);

  	io.to(oUser.roomId).emit('user joined', room.users.toJSON());
    console.log(room.users.toJSON());
  });

  var countDown;
  socket.on('user is ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', true);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());

    if (_everyoneReady(room.users)){
      console.log("countdown start!");
      countDown = setTimeout(function(){
        io.to(user.get('roomId')).emit('game start');
        console.log("game start!");
      }, 10000)
    }

  })
  socket.on('user is not ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', false);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    clearTimeout(countDown);
    console.log("can't start game yet!");
  })
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var _everyoneReady = function(users){
  return users.every(function(user){
    return user.get('userStatus');
  });

}