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
var GAMEOVER_SCENE_MAFIA_WIN = 666;
var GAMEOVER_SCENE_VILLAGER_WIN = 999;

app.get('/', function(req, res){
  res.sendfile('index.html');
});


io.on('connection', function(socket){
	socket.emit('connected');
  console.log('connected');

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
    console.log('user joined');
  });

  var countDown;
  socket.on('user is ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', true);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    console.log('ready status');

    if (_isGameReady(room.users)){
      countDown = setTimeout(function(){
        console.log('countdown start');
        _setRoles(room.users);
        var gameData = {
          users: room.users.toJSON(),
          scene: room.get('scene')
        };
        io.to(user.get('roomId')).emit('game start', gameData);
        console.log('game start');
      }, YOUR_FAVORITE_TIME)
    }

  });
  socket.on('user is not ready', function(){
    var user = allUsers.get(socket.id);
    var room = rooms.getOrInit(user.get('roomId'));
    user.set('userStatus', false);
    io.to(user.get('roomId')).emit('ready status', room.users.toJSON());
    clearTimeout(countDown);
    console.log('user is not ready');
  });

  socket.on('new message', function(msg){
    var user = allUsers.get(socket.id);
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
    clearTimeout(countDown);
    user = allUsers.get(socket.id);
    user.set('generalVote', vote);
    roomId = user.get('roomId');
    room = rooms.getOrInit(roomId);
    io.to(roomId).emit('general vote update', room.users.toJSON()); 
    console.log('general vote update');
    
    aliveUsers = _filterOutAliveUsers(room.users);
    aliveUsers = new Backbone.Collection(aliveUsers);
    chosenUserId = _chosenOne(aliveUsers, 'generalVote');

    if (_didEveryoneGeneralVote(aliveUsers) && chosenUserId){  
      io.to(roomId).emit('start general vote countdown');
      console.log('start general vote countdown');
      countDown = setTimeout(function(){
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
    var user, roomId, room, aliveMafias, chosenByMafiaUserId, aliveDoctors, gameData = {deadUserId : null};
    clearTimeout(countDown);
    user = allUsers.get(socket.id);
    user.set('specialVote', vote);
    roomId = user.get('roomId');
    room = rooms.getOrInit(roomId);
    io.to(roomId).emit('special vote update', room.users.toJSON()); 
    console.log('special vote update');

    aliveMafias = _filterOutAliveMafias(room.users);
    aliveMafias = new Backbone.Collection(aliveMafias);
    chosenByMafiaUserId = _chosenOne(aliveMafias, 'specialVote');

    aliveDoctors = _filterOutAliveDoctors(room.users);
    aliveDoctors = new Backbone.Collection(aliveDoctors);
    chosenByDoctorUserId = _chosenOne(aliveDoctors, 'specialVote');
    
    if (_didEveryoneSpecialVote(room.users) && chosenByMafiaUserId){  
      io.to(roomId).emit('start special vote countdown');
      console.log('start special vote countdown');
      countDown = setTimeout(function(){
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
  chosenUser.set('alive', false);
}

var _resetAllVote = function(users){
  users.each(function(user){
    user.set('generalVote', null);
    user.set('specialVote', null);
  })
}

var _updateScene = function(room){
  var aliveUsers = _filterOutAliveUsers(room.users);
  var aliveMafias = _filterOutAliveMafias(room.users);
  var aliveInnocents = aliveUsers - aliveMafias;
  if (aliveMafias == 0){
    room.set('scene', GAMEOVER_SCENE_VILLAGER_WIN); 
  } else if (aliveMafias >= aliveInnocents){
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



