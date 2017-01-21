var User = Backbone.Model.extend({
	setRoom: function(room) {
		this.room = room
	}

})

module.exports = User;