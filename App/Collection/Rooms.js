var Rooms = Backbone.Collection.extend({
	getOrInit: function(roomId) {
		//if room doesn't exist make a room.
		var room = this.get(roomId);
  	if (!room){
  		room = new App.Model.Room({id: roomId});
  		this.add(room);
  	}
  	return room;
	}
})

module.exports = Rooms;