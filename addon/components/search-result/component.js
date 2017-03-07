import Ember from 'ember';
import layout from './template';

/**
 * Adapted from Ember-SHARE - some pieces added from Ember-Preprints as well.
 *
 * ```handlebars
 * {{search-result
 *      detailRoute=detailRoute
 *      addFilter='addFilter'
 *      obj=obj
 * }}
 * ```
 * @class search-result
 */
export default Ember.Component.extend({
    layout,
    maxTags: 5,
    maxSubjects: 5,
    maxCreators: 10,
    maxDescription: 350,
    showBody: false,
    providerUrlRegex: {
        //'bioRxiv': '', doesnt currently have urls
        Cogprints: /cogprints/,
        OSF: /https?:\/\/((?!api).)*osf.io/, // Doesn't match api.osf urls
        PeerJ: /peerj/,
        arXiv: /arxivj/
    },
    detailRoute: null, //Add name of route you want search-result to link to if not using Ember-SHARE detail page
    footerIcon: Ember.computed('showBody', function() {
        return this.get('showBody') ? 'caret-up' : 'caret-down';
    }),

    type: Ember.computed('obj.type', function() {
        return this.get('obj.type').replace(/\w\S*/g, function(str) {return str.capitalize();});
    }),
    safeTitle: Ember.computed('obj.title', function() {
        return Ember.String.htmlSafe(this.get('obj.title')).string;
    }),
    safeDescription: Ember.computed('obj.description', function() {
        return Ember.String.htmlSafe(this.get('obj.description')).string;
    }),
    abbreviated: Ember.computed('safeDescription', function() {
        return this.get('safeDescription').length > this.get('maxDescription');
    }),
    abbreviation: Ember.computed('safeDescription', function() {
        return this.get('safeDescription').slice(0, this.get('maxDescription'));
    }),
    allCreators: Ember.computed('obj.lists.contributors', function() {
        return (this.get('obj.lists.contributors') || []).filterBy('relation', 'creator').sortBy('order_cited');
    }),
    extraCreators: Ember.computed('allCreators', function() {
        return this.get('allCreators').slice(this.get('maxCreators'));
    }),
    creators: Ember.computed('allCreators', function() {
        return this.get('allCreators').slice(0, this.get('maxCreators'));
    }),
    extraTags: Ember.computed('obj.tags', function() {
        return (this.get('obj.tags') || []).slice(this.get('maxTags'));
    }),
    identifiers: Ember.computed('obj.identifiers', function() {
        return this.get('obj.identifiers');
    }),
    tags: Ember.computed('obj.tags', function() {
        return (this.get('obj.tags') || []).slice(0, this.get('maxTags'));
    }),
    subjects: Ember.computed('obj.subjects', function() {
        return (this.get('obj.subjects') || []).slice(0, this.get('maxSubjects'));
    }),
    extraSubjects: Ember.computed('obj.subjects', function() {
        return (this.get('obj.subjects') || []).slice(this.get('maxSubjects'));
    }),
    retractionId: Ember.computed('obj.lists.retractions[]', function() {
        const retractions = this.get('obj.lists.retractions');
        if (retractions && retractions.length) {
            return retractions[0].id;
        }
        return null;
    }),
    osfID: Ember.computed('obj', function() {
        let re = /osf.io\/(\w+)\/$/;
        // NOTE / TODO : This will have to be removed later. Currently the only "true" preprints are solely from the OSF
        // socarxiv and the like sometimes get picked up by as part of OSF, which is technically true. This will prevent
        // broken links to things that aren't really preprints.
        if (this.get('obj.providers.length') === 1 && this.get('obj.providers').find(provider => provider.name === 'OSF'))
            for (let i = 0; i < this.get('obj.identifiers.length'); i++)
                if (re.test(this.get('obj.identifiers')[i]))
                    return re.exec(this.get('obj.identifiers')[i])[1];
        return false;
    }),
    hyperlink: Ember.computed('obj', function() {
        let re = null;
        for (let i = 0; i < this.get('obj.providers.length'); i++) {
            //If the result has multiple providers, and one of them matches, use the first one found.
            re = this.providerUrlRegex[this.get('obj.providers')[i].name];
            if (re) break;
        }

        re = re || this.providerUrlRegex.OSF;

        const identifiers = this.get('obj.identifiers').filter(ident => ident.startsWith('http://'));

        for (let j = 0; j < identifiers.length; j++)
            if (re.test(identifiers[j]))
                return identifiers[j];

        return identifiers[0];
    }),
    didRender() {
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, this.$()[0]]);  // jshint ignore: line
    },
    actions: {
        addFilter(type, filter) {
            this.sendAction('addFilter', type, filter);
        },
        toggleShowBody() {
            this.set('showBody', !this.showBody);
        },

    }
});
