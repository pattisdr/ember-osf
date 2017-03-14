import Ember from 'ember';
import layout from './template';


/**
 * @module ember-osf
 * @submodule components
 */

/**
 *
 * Creates a link to contributor name if link exists, otherwise just displays contributor name
 *
 * Sample usage:
 * ```handlebars
 * {{author-link
 *      contributor=contributor
 *}}
 * ```
 * @class author-link
 */
export default Ember.Component.extend({
    layout,
    tagName: 'li',
    contributor: null,

    profileLink: Ember.computed('contributor', function() {
        // Changed from contributor.users.identifiers
        const contributor = this.get('contributor');
        let ids = contributor.users ? contributor.users.identifiers || [] : contributor.identifiers || [];

        for (let i = 0; i < ids.length; i++)
            if (ids[i].match(/^https?:\/\/(?:.*\.)osf\.io/))
                    return ids[i];

        return false;
    }),
    contributorName: Ember.computed('contributor', function() {
        const contributor = this.get('contributor');
        return contributor.users ? contributor.users.name : contributor.name;
    })
});
