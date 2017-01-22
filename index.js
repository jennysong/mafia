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
var YOUR_FAVORITE_TIME = 3000;

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
  });

  var countDown;
  socket.on('user is ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', true);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());

    if (_isGameReady(room.users)){
      countDown = setTimeout(function(){
        _setRoles(room.users);
        var gameData = {
          users: room.users.toJSON(),
          scene: 1
        };
        io.to(user.get('roomId')).emit('game start', gameData);
      }, YOUR_FAVORITE_TIME)
    }

  });
  socket.on('user is not ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', false);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    clearTimeout(countDown);
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
  });

  socket.on('general vote', function(vote){
    clearTimeout(countDown);
    var user = allUsers.get(socket.id);
    user.set('generalVote', vote);
    var roomId = user.get('roomId');
    var room = rooms.getOrInit(roomId);
    io.to(roomId).emit('general vote update', room.users.toJSON());
    
    var chosenUserId = _chosenOne(room.users);
    if (_didEveryoneGeneralVote(room.users) && chosenOne){  
      io.to(roomId).emit('start general vote countdown');
      countDown = setTimeout(function(){
        _kill(chosenUserId);
        io.to(roomId).emit('someone is dead', room.users.toJSON());
      }, YOUR_FAVORITE_TIME);
    }
  })

  socket.on('special vote', function(vote){
    var user = allUsers.get(socket.id);
    user.set('specialVote', vote);
    var room = rooms.getOrInit(user.get('roomId'));
    if (_isSpecialVoteDone(room.users)){

    }
  })



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

var _didEveryoneGeneralVote = function(users){
  return users.every(function(user){
    return user.get('generalVote');
  });
}

var _chosenOne = function(users){
  var countedVote = users.countBy('generalVote');
  var maxCount = _(countedVote).max(function(val, key){
    return val;
  })
  var ans, count = 0;
  _(countedVote).each(function(val,key){
    if (val == maxCount){
      ans = key;
      count++;
    }
  })
  if(count>1){
    ans = null;
  }
  return ans;
}

var _kill = function(userId){
  var chosenUser = allUsers.get(chosenUserId);
  chosenUser.set('alive', false);
}


var _isSpecialVoteDone = function(users){

}