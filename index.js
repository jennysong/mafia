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

    if (_isGameReady(room.users)){
      console.log("countdown start!");
      countDown = setTimeout(function(){
        _setRoles(room.users);
        io.to(user.get('roomId')).emit('game start', room.users.toJSON());
        console.log("game start!");
      }, 1000)
    }

  });
  socket.on('user is not ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', false);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    clearTimeout(countDown);
    console.log("can't start game yet!");
  });

  socket.on('new message', function(msg){
    var user = allUsers.get(socket.id);
    var userName = user.get('userName');
    var oMsg = {
      writer : userName,
      msg: msg
    };
    io.to(user.get('roomId')).emit('update message', oMsg)
    var room = rooms.getOrInit(user.get('roomId'));
    console.log(room.users.toJSON());
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var _isGameReady = function(users){
  return users.every(function(user){  //>3 users.size > 0 &&
    return user.get('userStatus');
  });
}

var _setRoles = function(users){
  var numOfMafia, numOfDoctor = 0, numOfPolice = 0, numOfVillager;
  var userCount = users.size();
  var arr = _.range(0,userCount);
  var shuffledArr = _.shuffle(arr);
  numOfMafia = Math.floor(userCount/3);
  if (userCount > 4) {
    numOfDoctor = 1;
  }
  if (userCount > 6) {
    numOfPolice = 1;
  }
  numOfVillager = userCount - numOfMafia - numOfDoctor - numOfPolice;
  for (var i = 0; i<numOfMafia; i++){
    users.at(arr[i]).set('role', 'mafia');
  }
  for (var i = numOfMafia; i<numOfMafia+numOfDoctor; i++){
    users.at(arr[i]).set('role', 'doctor');
  }
  for (var i = numOfMafia+numOfDoctor; i<numOfMafia+numOfDoctor+numOfPolice; i++){
    users.at(arr[i]).set('role', 'police');
  }
  for (var i = numOfMafia+numOfDoctor+numOfPolice; i<userCount; i++){
    users.at(arr[i]).set('role', 'villager');
  }
}