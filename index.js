var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var require_tree = require('require-tree');
global.path = require('path');
global._ = require('underscore');
global.Backbone = require('backbone');
global.App = require_tree(path.dirname(require.main.filename)+"/App");

var rooms = new App.Collection.Rooms([], {model: App.Model.Room});
var users = new App.Collection.Users([], {model: App.Model.User});

app.get('/', function(req, res){
  res.sendfile('index.html');
});

//userList = [{userName, avatarId, avatarBg, userStatus}, {}, {}, {}]

io.on('connection', function(socket){
	socket.emit('connected')
  socket.on('user join', function(oUser){
    console.log("user join");
  	socket.join(oUser.roomId);
  	io.to(oUser.roomId).emit('user joined', oUser.userName);

  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});