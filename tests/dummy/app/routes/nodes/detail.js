import Ember from 'ember';

export default Ember.Route.extend({
    model(params) {
        return this.store.findRecord('node', params.node_id);
    },

    setupController(controller, model) {
        controller.set('editedTitle', model.get('title'));
        this._super(...arguments);
    },

    actions: {
        editExisting(value) {
            // TODO: Should test PUT or PATCH
            console.log('Will edit title from', this.modelFor(this.routeName).get('title'), ' to ', value);
            var node = this.modelFor(this.routeName);
            if (node.get('currentUserPermissions').indexOf('write') !== -1) {
                node.set('title', value);
                node.save();
            } else {
                console.log('You do not have permissions to edit this node');
            }
        },
        addChildren(title, description){
          var node = this.modelFor(this.routeName);
          var child = this.store.createRecord('children', {
            title: title,
            category: 'project',
            description: description || null,
            parentId: node.id
          })
          child.save()

        }
    }

});
