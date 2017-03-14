import Ember from 'ember';
import layout from './template';
import config from 'ember-get-config';
import moment from 'moment';
import { getUniqueList, getSplitParams, encodeParams } from '../../utils/elastic-query';

/**
 * @module ember-osf
 * @submodule components
 */

/**
 * Discover-page component. Component that can build majority of search page that utilizes SHARE.
 * See retraction-watch for working example.
 * Adapted from Ember-SHARE https://github.com/CenterForOpenScience/ember-share and preprints discover page.
 *
 * Sample usage: Pass in custom text like searchPlaceholder.  The facet property will enable you to customize the filters
 *  on the left-hand side of the discover page. Sort options are the sort dropdown options.  The lockedParams are the
 *  query parameters that are always locked in your application.  Also, each query parameter must be passed in individually,
 *  so they are reflected in the URL.  Logo and custom colors must be placed in your application's stylesheet. Individual components
 *  can additionally be overridden on your application.  Your searchUrl must be defined in your config/environment.js file.
 *
 *
 * ```handlebars
 *{{discover-page
 *   searchPlaceholder=(t 'discover.search.placeholder')
 *   searchButton=(t 'global.search')
 *   poweredBy=(t 'discover.search.paragraph')
 *   queryParams=queryParams
 *   facets=facets (list of dictionaries. Keys include key, title, component, and locked_item)
 *   sortOptions=sortOptions (list of dictionaries, with keys display and sortBy)
 *   lockedParams=lockedParams (hash of query parameters that are locked. For example, on retraction watch, {types: 'retraction'})
 *   q=q
 *   tags=tags
 *   sources=sources
 *   publishers=publishers
 *   funders=funders
 *   institutions=institutions
 *   organizations=organizations
 *   language=language
 *   contributors=contributors
 *   start=start
 *   end=end
 *   type=type
 *   sort=sort
* }}
 * ```
 * @class discover-page
 */

const MAX_SOURCES = 500;
let filterQueryParams = ['subject', 'provider', 'tags', 'sources', 'publishers', 'funders', 'institutions', 'organizations', 'language', 'contributors', 'type'];

export default Ember.Component.extend({
    layout,
    theme: Ember.inject.service(),
    i18n: Ember.inject.service(),
    classNames: ['discover-page'],

    activeFilters: { providers:[], subjects:[], types:[] }, // Filters that you want to show up in Active Filters box - currently just providers and subjects options
    clearFiltersButton: Ember.computed(function() { // Text for clearFilters button
        return this.get('i18n').t('eosf.components.discoverPage.activeFilters.button');
    }),
    collapsedFilters: true,
    collapsedQueryBody: true,
    consumingService: null, // Consuming service, like "preprints" or "registries"
    contributors: '', // Query parameter
    detailRoute: null, // Name of detail route, like "content" or "detail"
    discoverHeader: null, // Text header for top of discover page
    end: '', // Query parameter
    eventsLastUpdated: new Date().toString(),
    facets: Ember.computed('processedTypes', function() {  // Default facets - can pass in as property to component
        return [
            { key: 'sources', title: 'Source', component: 'search-facet-source' },
            { key: 'date', title: 'Date', component: 'search-facet-daterange' },
            { key: 'type', title: 'Type', component: 'search-facet-worktype', data: this.get('processedTypes') },
            { key: 'tags', title: 'Tag', component: 'search-facet-typeahead' },
            { key: 'publishers', title: 'Publisher', component: 'search-facet-typeahead', base: 'agents', type: 'publisher' },
            { key: 'funders', title: 'Funder', component: 'search-facet-typeahead', base: 'agents', type: 'funder' },
            { key: 'language', title: 'Language', component: 'search-facet-language' },
            { key: 'contributors', title: 'People', component: 'search-facet-typeahead', base: 'agents', type: 'person' },
        ];
    }),
    filterMap: {}, // A map of active filters to facet names expected by SHARE
    filterReplace: {},  // A map filter names for front-end display
    funders: '', // Query parameter
    institutions: '', // Query parameter
    language: '', // Query parameter
    loading: true,
    lockedParams: {}, // Example: {'sources': 'PubMed Central'} will make PubMed Central a locked source that cannot be changed
    noResults: Ember.computed(function() { // Text to display if no results found
        return this.get('i18n').t('eosf.components.discoverPage.broadenSearch');
    }),
    numberOfResults: 0,
    numberOfSources: 0,
    organizations: '', // Query parameter
    page: 1, // Query parameter
    poweredBy: Ember.computed(function() { // Powered by text
        return this.get('i18n').t('eosf.components.discoverPage.poweredBy');
    }),
    publishers: '', // Query parameter
    provider: '', // Query parameter
    providerName: null, // Provider name, if theme.isProvider, ex: psyarxiv
    q: '', // Query parameter
    queryParams:  Ember.computed(function() { // Query params
        let allParams = ['q', 'start', 'end', 'sort', 'page'];
        allParams.push(...filterQueryParams);
        return allParams;
    }),
    results: Ember.ArrayProxy.create({ content: [] }),
    searchButton: Ember.computed(function() { // Search button text
        return this.get('i18n').t('eosf.components.discoverPage.search');
    }),
    searchPlaceholder: Ember.computed(function() { // Search bar placeholder text
        return this.get('i18n').t('eosf.components.discoverPage.searchPlaceholder');
    }),
    shareTotalText: Ember.computed(function() {
        return this.get('i18n').t('eosf.components.discoverPage.shareTotalText');
    }),
    showActiveFilters: false, // Should active filters box be displayed (currently only displays providers/subjects
    size: 10, // Query parameter
    sort: '', // Query parameter
    sortOptions: [{ // Default sort options
        display: 'Relevance',
        sortBy: ''
    }, {
        display: 'Date Updated (Desc)',
        sortBy: '-date_updated'
    }, {
        display: 'Date Updated (Asc)',
        sortBy: 'date_updated'
    }, {
        display: 'Ingest Date (Asc)',
        sortBy: 'date_created'
    }, {
        display: 'Ingest Date (Desc)',
        sortBy: '-date_created'
    }],
    sources: '', // Query parameter
    start: '', // Query parameter
    subject: '', // Query parameter
    tags: '', // Query parameter
    took: 0,
    type: '', // Query parameter

    noResultsMessage: Ember.computed('numberOfResults', function() {
        // Message can be overridden as component property
        return this.get('numberOfResults') > 0 ? '' : this.get('noResults');
    }),

    totalPages: Ember.computed('numberOfResults', 'size', function() {
        return Math.ceil(this.get('numberOfResults') / this.get('size'));
    }),

    // TODO update this property if a solution is found for the elastic search limitation.
    // Ticket: SHARE-595
    clampedPages: Ember.computed('totalPages', 'size', function() {
        let maxPages = Math.ceil(10000 / this.get('size'));
        let totalPages = this.get('totalPages');
        return totalPages < maxPages ? totalPages : maxPages;
    }),

    hiddenPages: Ember.computed('clampedPages', 'totalPages', function() {
        const total = this.get('totalPages');
        const max = this.get('clampedPages');
        if (total !== max) {
            return total - max;
        }
        return null;
    }),

    processedTypes: Ember.computed('types', function() {
        return this.transformTypes(this.get('types'));
    }),


    reloadSearch: Ember.observer('activeFilters', function() {
        this.set('page', 1);
        this.loadPage();
    }),

    init() {
        //TODO Sort initial results on date_modified
        this._super(...arguments);
        this.set('firstLoad', true);
        this.set('facetFilters', Ember.Object.create());
        this.getTypes();
        this.set('debouncedLoadPage', this.loadPage.bind(this));
        this.getCounts();
        this.loadProvider();
        this.loadPage();
    },

    // Loads preprint provider if theme.isProvider
    loadProvider() {
        if (this.get('theme.isProvider')) {
            this.get('theme.provider').then(provider => {
                this.set('providerName', provider.get('name'));
                this.loadPage();
            });
        }
    },

    getCounts() {
        let queryBody = JSON.stringify({
            size: 0,
            aggregations: {
                sources: {
                    cardinality: {
                        field: 'sources',
                        precision_threshold: MAX_SOURCES
                    }
                }
            }
        });
        return Ember.$.ajax({
            url: this.get('searchUrl'),
            crossDomain: true,
            type: 'POST',
            contentType: 'application/json',
            data: queryBody
        }).then((json) => {
            this.setProperties({
                numberOfEvents: json.hits.total,
                numberOfSources: json.aggregations.sources.value
            });
        });
    },

    transformTypes(obj) {
        if (typeof (obj) !== 'object') {
            return obj;
        }

        for (let key in obj) {
            let lowKey = key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
            obj[lowKey] = this.transformTypes(obj[key]);
            if (key !== lowKey) {
                delete obj[key];
            }
        }
        return obj;
    },

    getTypes() {
        return Ember.$.ajax({
            url: config.SHARE.apiUrl + '/schema/creativework/hierarchy/',
            crossDomain: true,
            type: 'GET',
            contentType: 'application/vnd.api+json',
        }).then((json) => {
            if (json.data) {
                this.set('types', json.data);
            }
        });
    },

    searchUrl: Ember.computed(function() {
        return config.SHARE.searchUrl;
    }),

    buildLockedQueryBody(lockedParams) {
        // Takes in a dictionary of locked param keys matched to the locked value and builds the locked portion of the query
        let queryBody = [];
        Object.keys(lockedParams).forEach(key => {
            let query = {};
            let queryKey = [`${key}`]; //Change to .exact at some point?
            if (key === 'tags') {
                queryKey = key;
            } else if (key === 'contributors') {
                queryKey = 'lists.contributors.name'; //Change to .exact at some point?
            }

            query[queryKey] = lockedParams[key];
            queryBody.push({
                term: query
            });
        });
        return queryBody;
    },

    // Builds SHARE query
    getQueryBody() {
        let filters = this.buildLockedQueryBody(this.get('lockedParams')); // Empty list if no locked query parameters
        let facetFilters = this.get('facetFilters');
        for (let k of Object.keys(facetFilters)) {
            let filter = facetFilters[k];
            if (filter) {
                if (Ember.$.isArray(filter)) {
                    filters = filters.concat(filter);
                } else {
                    filters.push(filter);
                }
            }
        }

        // Copied from preprints - add activeFilters into to SHARE query
        const activeFilters = this.get('activeFilters');
        const filterMap = this.get('filterMap');
        for (const key in filterMap) {
            const val = filterMap[key];
            const filterList = activeFilters[key];

            if (!filterList.length || (key === 'providers' && this.get('theme.isProvider')))
                continue;

            filters.push({
                terms: {
                    [val]: filterList
                }
            });
        }
        // Adapted from preprints and registries - modify subject and providers and types filters
        Object.keys(activeFilters).forEach(pluralFilter => {
            const filter = Ember.String.singularize(pluralFilter);
            if (pluralFilter !== 'providers' || !this.get('theme.isProvider')) {
                this.set(`${filter}`, activeFilters[pluralFilter].join('AND'));
            }
        });

        // Copied from preprints
        if (this.get('theme.isProvider') && this.get('providerName') !== null) {
            filters.push({
                terms: {
                    sources: [this.get('providerName')]
                }
            });
        }

        let query = {
            query_string: {
                query: this.get('q') || '*'
            }
        };
        if (filters.length) {
            query = {
                bool: {
                    must: query,
                    filter: filters
                }
            };
        }

        let page = this.get('page');
        let queryBody = {
            query,
            from: (page - 1) * this.get('size')
        };
        if (this.get('sort')) {
            let sortBy = {};
            sortBy[this.get('sort').replace(/^-/, '')] = this.get('sort')[0] === '-' ? 'desc' : 'asc';
            queryBody.sort = sortBy;
        }
        if (page === 1 || this.get('firstLoad')) {
            queryBody.aggregations = this.get('elasticAggregations');
        }

        this.set('displayQueryBody', { query });
        return this.set('queryBody', queryBody);
    },

    elasticAggregations: Ember.computed(function() {
        return {
            sources: {
                terms: {
                    field: 'sources',
                    size: MAX_SOURCES
                }
            }
        };
    }),

    loadPage() {
        let queryBody = JSON.stringify(this.getQueryBody());
        this.set('loading', true);
        return Ember.$.ajax({
            url: this.get('searchUrl'),
            crossDomain: true,
            type: 'POST',
            contentType: 'application/json',
            data: queryBody
        }).then((json) => {
            if (this.isDestroyed || this.isDestroying) return;
            let results = json.hits.hits.map(hit => {
                // HACK: Make share data look like apiv2 preprints data
                let result = Ember.merge(hit._source, {
                    id: hit._id,
                    type: 'elastic-search-result',
                    workType: hit._source['@type'],
                    abstract: hit._source.description,
                    subjects: hit._source.subjects.map(each => ({text: each})),
                    providers: hit._source.sources.map(item => ({name: item})),
                    hyperLinks: [// Links that are hyperlinks from hit._source.lists.links
                        {
                            type: 'share',
                            url: config.SHARE.baseUrl + 'preprint/' + hit._id
                        }
                    ],
                    infoLinks: [], // Links that are not hyperlinks  hit._source.lists.links
                    registrationType: hit._source.registration_type
                });

                hit._source.identifiers.forEach(function(identifier) {
                    if (identifier.startsWith('http://')) {
                        result.hyperLinks.push({url: identifier});
                    } else {
                        const spl = identifier.split('://');
                        const [type, uri, ..._] = spl; // jshint ignore:line
                        result.infoLinks.push({type, uri});
                    }
                });

                result.contributors = result.lists.contributors ? result.lists.contributors
                  .sort((b, a) => (b.order_cited || -1) - (a.order_cited || -1))
                  .map(contributor => ({
                        users: Object.keys(contributor)
                          .reduce(
                              (acc, key) => Ember.merge(acc, {[key.camelize()]: contributor[key]}),
                              {bibliographic: contributor.relation !== 'contributor'}
                          )
                    })) : [];

                // Temporary fix to handle half way migrated SHARE ES
                // Only false will result in a false here.
                result.contributors.map(contributor => contributor.users.bibliographic = !(contributor.users.bibliographic === false));  // jshint ignore:line

                return result;
            });

            if (json.aggregations) {
                this.set('aggregations', json.aggregations);
            }
            this.setProperties({
                numberOfResults: json.hits.total,
                took: moment.duration(json.took).asSeconds(),
                loading: false,
                firstLoad: false,
                results: results,
                queryError: false
            });
            if (this.get('totalPages') && this.get('totalPages') < this.get('page')) {
                this.search();
            }
        }, (errorResponse) => {
            this.setProperties({
                loading: false,
                firstLoad: false,
                numberOfResults: 0,
                results: []
            });
            if (errorResponse.status === 400) {
                this.set('queryError', true);
            } else {
                this.send('elasticDown');
            }
        });
    },

    search() {
        if (!this.get('firstLoad')) {
            this.set('page', 1);
        }
        this.set('loading', true);
        this.get('results').clear();
        Ember.run.debounce(() => {
            this.get('debouncedLoadPage')();
        }, 500);
    },

    facetStatesArray: [],

    facetStates: Ember.computed(...filterQueryParams, 'end', 'start', function() {
        let facetStates = {};
        for (let param of filterQueryParams) {
            facetStates[param] = getSplitParams(this.get(param));
        }
        facetStates.date = { start: this.get('start'), end: this.get('end') };

        Ember.run.once(this, function() {
            let facets = this.get('facetStates');
            let facetArray = [];
            for (let key of Object.keys(facets)) {
                facetArray.push({ key: key, value: facets[key] });
            }
            this.set('facetStatesArray', facetArray);
        });
        return facetStates;
    }),

    scrollToResults() {
        Ember.$('html, body').scrollTop(Ember.$('.results-top').position().top);
    },

    actions: {
        // COPIED FROM EMBER-SHARE/APP/ROUTES/DISCOVER.JS. What does this do??
        elasticDown() {
            // this.intermediateTransitionTo('elastic-down');
            return false;
        },

        addFilter(type, filterValue) {
            let currentValue = getSplitParams(this.get(type)) || [];
            let newValue = getUniqueList([filterValue].concat(currentValue));
            this.set(type, encodeParams(newValue));
        },

        removeFilter(type, filterValue) {
            let currentValue = getSplitParams(this.get(type)) || [];
            let index = currentValue.indexOf(filterValue);
            if (index > -1) {
                currentValue.splice(index, 1);
            }
            currentValue = currentValue.length ? encodeParams(currentValue) : '';
            this.set(type, currentValue);
            this.get('facetFilters');
        },

        toggleCollapsedQueryBody() {
            this.toggleProperty('collapsedQueryBody');
        },

        toggleCollapsedFilters() {
            this.toggleProperty('collapsedFilters');
        },

        typing(val, event) {
            // Ignore all keycodes that do not result in the value changing
            // 8 == Backspace, 32 == Space
            if (event.keyCode < 49 && !(event.keyCode === 8 || event.keyCode === 32)) {
                return;
            }
            this.search();
        },

        search() {
            this.search();
        },

        updateParams(key, value) {
            if (key === 'date') {
                this.set('start', value.start);
                this.set('end', value.end);
            } else {
                value = value ? encodeParams(value) : '';
                this.set(key, value);
            }
        },

        filtersChanged() {
            this.search();
        },

        loadPageNoScroll(newPage) {
            this.send('loadPage', newPage, false);
        },

        loadPage(newPage, scroll = true) {
            if (newPage === this.get('page') || newPage < 1 || newPage > this.get('totalPages')) {
                return;
            }

            this.set('page', newPage);
            if (scroll) {
                this.scrollToResults();
            }
            this.loadPage();
        },
        // From Ember Preprints
        setLoadPage(pageNumber) {
            this.set('page', pageNumber);
            if (scroll) {
                this.scrollToResults();
            }
            this.loadPage();
        },

        selectSortOption(option) {
            this.set('sort', option);
            this.search();
        },

        clearFilters() {
            // Clears facetFilters for SHARE-type facets
            this.set('facetFilters', Ember.Object.create());
            for (var param in filterQueryParams) {
                let key = filterQueryParams[param];
                if (filterQueryParams.indexOf(key) > -1) {
                    this.set(key, '');
                }
            }
            this.set('start', '');
            this.set('end', '');
            this.set('sort', '');
            this.search();
            // Clears Active Filters for Preprints/Registries
            let restoreActiveFilters = {};
            Object.keys(this.get('activeFilters')).forEach(filter => {
                if (filter === 'providers') {
                    restoreActiveFilters[filter] = this.get('theme.isProvider') ? this.get('activeFilters.providers') : [];
                } else {
                    restoreActiveFilters[filter] = [];
                }

            });
            this.set('activeFilters', restoreActiveFilters);
        },
        updateFilters(filterType, item) {
            item = typeof item === 'object' ? item.text : item;
            const filters = Ember.$.extend(true, [], this.get(`activeFilters.${filterType}`));
            const hasItem = filters.includes(item);
            const action = hasItem ? 'remove' : 'push';
            filters[`${action}Object`](item);
            this.set(`activeFilters.${filterType}`, filters);
            this.notifyPropertyChange('activeFilters');
        },
    }
});
