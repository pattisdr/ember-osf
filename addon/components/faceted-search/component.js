import Ember from 'ember';
import layout from './template';

export default Ember.Component.extend({
    layout,
    init() {
        this._super(...arguments);
    },

    actions: {
        facetChanged(key, facet, value) {
            let filters = this.get('filters');
            filters.set(key, facet);
            this.sendAction('updateParams', key, value);
            this.sendAction('onChange', filters);
        }
    }
});
