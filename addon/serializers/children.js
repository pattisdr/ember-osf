import OsfSerializer from './osf-serializer';

export default OsfSerializer.extend({
    serialize: function(snapshot, options) {
        var serialized = this._super(snapshot, options);
        // Don't send relationships to the server; this can lead to 500 errors.
        delete serialized.data.relationships;
        serialized.data.type = 'nodes';
        return serialized;
    }
});
