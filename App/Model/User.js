var User = Backbone.Model.extend({
  
  defaults: {
    userName : null,
    avatarId : null,
    avatarBg : null,
    userStatus : null,
    roomId : null,
    id : null,
    role: null,
    alive: true,
    generalVote: null,
    specialVote: null

  },

	setRoom: function(room) {
		this.room = room;
	}

})

module.exports = User;