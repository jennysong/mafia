var Room = Backbone.Model.extend({
  defaults : {
    id : null,
    scene : 1
  },

	initialize: function(attrs, options) {
		this.users = new App.Collection.Users([], {model: App.Model.User});
	},

	addUser: function(user) {
		this.users.add(user);
		user.setRoom(this);
	}
})

module.exports = Room;