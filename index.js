var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var require_tree = require('require-tree');
global.uuid = require('uuid');
global.path = require('path');
global._ = require('underscore');
global.Backbone = require('backbone');
global.App = require_tree(path.dirname(require.main.filename)+"/App");

var rooms = new App.Collection.Rooms([], {model: App.Model.Room});
var allUsers = new App.Collection.Users([], {model: App.Model.User});
var YOUR_FAVORITE_TIME = 5000;
var GAMEOVER_SCENE_MAFIA_WIN = 666;
var GAMEOVER_SCENE_VILLAGER_WIN = 999;
var SERVER_PORT = parseInt(process.env.PORT || 3000)

app.get('/', function(req, res){
  res.sendfile('index.html');
});


io.on('connection', function(socket){
	socket.on('init new user', function() {
    var newUser = allUsers.initNew();
    socket.emit('user initialized', newUser.id);
  })

  socket.on('load user', function(sUserId) {
    socket.sUserId = sUserId
    _findUser(socket, function(user) {
      socket.emit('user found', user.toJSON());
    })
  })

  socket.on('user join', function(oUserAttrs){
    _findUser(socket, function(user) {
      oUserAttrs = _(oUserAttrs).pick('userName', 'avatarId', 'avatarBg', 'userStatus', 'roomId');
      user.set(oUserAttrs);

      var room = rooms.getOrInit(user.get('roomId'));
      if (room.get('isGameActive') == false){
          room.addUser(user);
          socket.join(user.get('roomId'));

          io.to(user.get('roomId')).emit('user joined', room.users.toJSON());
          console.log('user joined');
      } else {
        socket.emit('game already started');
      }
    })
  });

  socket.on('resume current game', function(){
    _findUser(socket, function(user) {
      var room = rooms.getOrInit(user.get('roomId'));
      room.addUser(user);
      socket.join(user.get('roomId'));

      if (room.get('isGameActive') == false){
        socket.emit('user joined', room.users.toJSON())
      } else {
        var gameData = {
          users: room.users.toJSON(),
          scene: room.get('scene')
        };
        socket.emit('game resumed', gameData)
      }
    })
  })


  socket.on('user is ready', function(){
    var user = allUsers.get(socket.sUserId);
    if(!user) return;
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', true);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    console.log('ready status');

    if (_isGameReady(room.users) && room.users.length > 2){
      room.countDown = setTimeout(function(){
        console.log('countdown start');
        room.set('isGameActive', true);
        _setRoles(room.users);
        var gameData = {
          users: room.users.toJSON(),
          scene: room.get('scene')
        };
        io.to(user.get('roomId')).emit('game started', gameData);
        console.log('game start');
      }, YOUR_FAVORITE_TIME)
    }

  });
  socket.on('user is not ready', function(){
    var user = allUsers.get(socket.sUserId);
    if(!user) return;
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', false);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    clearTimeout(room.countDown);
    console.log('user is not ready');
  });

  socket.on('new message', function(msg){
    var user = allUsers.get(socket.sUserId);
    if(!user) return;
    var userId = user.id;
    var oMsg = {
      userId : userId,
      msg: msg
    };
    io.to(user.get('roomId')).emit('update message', oMsg);
    console.log('update message');
    var room = rooms.getOrInit(user.get('roomId'));
  });

  socket.on('general vote', function(vote){
    var user, roomId, room, aliveUsers, chosenUserId, gameData;
    user = allUsers.get(socket.sUserId);
    if(!user) return;
    user.set('generalVote', vote);
    roomId = user.get('roomId');
    room = rooms.getOrInit(roomId);
    clearTimeout(room.countDown);
    io.to(roomId).emit('general vote update', room.users.toJSON());
    console.log('general vote update');

    aliveUsers = _filterOutAliveUsers(room.users);
    aliveUsers = new Backbone.Collection(aliveUsers);
    chosenUserId = _chosenOne(aliveUsers, 'generalVote');

    if (_didEveryoneGeneralVote(aliveUsers) && chosenUserId){
      io.to(roomId).emit('start general vote countdown');
      console.log('start general vote countdown');
      room.countDown = setTimeout(function(){
        _kill(chosenUserId);
        _updateScene(room);
        gameData = {
          users : room.users.toJSON(),
          deadUserId : chosenUserId,
          scene : room.get('scene')
        }
        io.to(roomId).emit('vote result', gameData);
        console.log('vote result. Next scene: ' + room.get('scene'));
      }, YOUR_FAVORITE_TIME);
    }
  })

  socket.on('special vote', function(vote){
    var user, roomId, room, aliveMafias, chosenByMafiaUserId, aliveDoctors, alivePolices, suspect, gameData = {deadUserId : null};
    user = allUsers.get(socket.sUserId);
    if(!user) return;
    user.set('specialVote', vote);
    roomId = user.get('roomId');
    room = rooms.getOrInit(roomId);
    clearTimeout(room.countDown);
    io.to(roomId).emit('special vote update', room.users.toJSON());
    console.log('special vote update');

    aliveMafias = _filterOutAliveMafias(room.users);
    aliveMafias = new Backbone.Collection(aliveMafias);
    chosenByMafiaUserId = _chosenOne(aliveMafias, 'specialVote');

    aliveDoctors = _filterOutAliveDoctors(room.users);
    aliveDoctors = new Backbone.Collection(aliveDoctors);
    chosenByDoctorUserId = _chosenOne(aliveDoctors, 'specialVote');

    alivePolices = _filterOutAlivePolices(room.users);
    if (alivePolices.length > 0){
      suspect = room.users.get(alivePolices[0].get('specialVote'));
      if (suspect.get('role') == 'mafia'){
        gameData.policeMessage = suspect.get('userName') + ' is a mafia';
      } else {
        gameData.policeMessage = suspect.get('userName') + ' is not a mafia';
      }
    }

    if (_didEveryoneSpecialVote(room.users) && chosenByMafiaUserId){
      io.to(roomId).emit('start special vote countdown');
      console.log('start special vote countdown');
      room.countDown = setTimeout(function(){
        if (chosenByMafiaUserId != chosenByDoctorUserId){
          _kill(chosenByMafiaUserId);
          gameData.deadUserId = chosenByMafiaUserId;
        }

        _resetAllVote(room.users);
        _updateScene(room);
        gameData.users = room.users.toJSON();
        gameData.scene = room.get('scene');

        io.to(roomId).emit('vote result', gameData);
        console.log('vote result. Next scene: ' + room.get('scene'));
      }, YOUR_FAVORITE_TIME);
    }
  })

  socket.on('leave current room', function(){
    var user = allUsers.get(socket.sUserId);
    if(!user) return;
    var room = rooms.get(user.get('roomId'));
    room.users.remove(user);
    socket.leave(user.get('roomId'));
    user.refreshAttributes()
    socket.emit('restart game')
    if (room.users.length == 0){
      rooms.remove(room);
    }
  })

});

http.listen(SERVER_PORT, function(){
  console.log('listening on *:'+SERVER_PORT.toString());
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
    users.at(shuffledArr[i]).set('role', 'mafia');
  }
  for (var i = numOfMafia; i<numOfMafia+numOfDoctor; i++){
    users.at(shuffledArr[i]).set('role', 'doctor');
  }
  for (var i = numOfMafia+numOfDoctor; i<numOfMafia+numOfDoctor+numOfPolice; i++){
    users.at(shuffledArr[i]).set('role', 'police');
  }
  for (var i = numOfMafia+numOfDoctor+numOfPolice; i<userCount; i++){
    users.at(shuffledArr[i]).set('role', 'villager');
  }
}


var _chosenOne = function(users, typeOfVote){
  var countedVote = users.countBy(typeOfVote);
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
  var chosenUser = allUsers.get(userId);
  if(!chosenUser) return;
  chosenUser.set('alive', false);
}

var _resetAllVote = function(users){
  users.each(function(user){
    user.set('generalVote', null);
    user.set('specialVote', null);
  })
}

var _updateScene = function(room){
  var aliveUsers = _filterOutAliveUsers(room.users).length;
  var aliveMafias = _filterOutAliveMafias(room.users).length;
  var aliveInnocents = aliveUsers - aliveMafias;
  if (aliveMafias == 0){
    room.set('scene', GAMEOVER_SCENE_VILLAGER_WIN);
  } else if (aliveMafias > aliveInnocents || (aliveMafias==1 && aliveInnocents==1)){
    room.set('scene', GAMEOVER_SCENE_MAFIA_WIN);
  } else {
    room.set('scene', room.get('scene')+1);
  }
}

var _didEveryoneGeneralVote = function(users){
  return users.every(function(user){
    return user.get('generalVote');
  });
}

var _didEveryoneSpecialVote = function(users){
  return users.every(function(user){
    return (user.get('specialVote') || user.get('alive') == false || user.get('role') == 'villager');
  });
}

var _filterOutAliveMafias = function(users){
  return users.filter(function(user){
    return (user.get('role') == 'mafia' && user.get('alive') == true);
  });
}

var _filterOutAlivePolices = function(users){
  return users.filter(function(user){
    return (user.get('role') == 'police' && user.get('alive') == true);
  });
}

var _filterOutAliveDoctors = function(users){
  return users.filter(function(user){
    return (user.get('role') == 'doctor' && user.get('alive') == true);
  });
}

var _filterOutAliveUsers = function(users){
  return users.filter(function(user){
    return user.get('alive') == true;
  });
}

var _findUser = function(socket, successCallback) {
  var user = allUsers.get(socket.sUserId);
  user ? successCallback(user) : socket.emit('cannot find user')
}

