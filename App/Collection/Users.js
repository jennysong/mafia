var Users = Backbone.Collection.extend({
  initNew: function() {
    oUser = new this.model({id: uuid.v4()});
    this.add(oUser);
    return oUser;
  }

})

module.exports = Users;