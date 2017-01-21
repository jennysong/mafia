var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var require_tree = require('require-tree');
global.path = require('path');
global._ = require('underscore');
global.Backbone = require('backbone');
global.App = require_tree(path.dirname(require.main.filename)+"/App");

var rooms = new App.Collection.Rooms([], {model: App.Model.Room});

app.get('/', function(req, res){
  res.sendfile('index.html');
});

app.get('/game', function(req, res){
	res.sendfile('game.html');
});

io.on('connection', function(socket){
	socket.emit('connected')
  socket.on('user join', function(oUser){
  	socket.join(oUser.gameId);
  	io.to(oUser.gameId).emit('user joined', oUser.name);

  	//var room = rooms.get(oUser.room);
  	//var room = rooms.getOrInit(oUser.room);

  	//create user
  	//var user = new App.Model.User({id: oUser.userId});
  	//room.addUser(user);
  	//socket.emit('go to waiting room', user.room.users.toJSON());


  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});