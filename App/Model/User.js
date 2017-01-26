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
	},

    refreshAttributes: function() {
        this.set(_(this.defaults).pick('userStatus', 'roomId', 'role', 'alive', 'generalVote', 'specialVote'))
    }

})

module.exports = User;