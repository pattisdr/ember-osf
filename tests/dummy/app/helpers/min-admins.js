import Ember from 'ember';

/**
 * minAdmins helper - used to determine if the user should be able to update permissions
 * of a particular contributor.  False if user is trying to update the permissions
 * of the sole admin.  All projects need at least one administrator.
 *
 */
export function minAdmins(params/*, hash*/) {
    var contrib = params[0];
    var contributors = params[1];
    if (contributors) {
        var numAdmins = 0;
        contributors.forEach(function(contributor) {
            if (contributor.get('permission') === 'admin') {
                numAdmins++;
            }
        });
        if (numAdmins === 1 && contrib.get('permission') === 'admin') {
            return false;
        } else {
            return true;
        }
    } else {
        return params;
    }
}

export default Ember.Helper.helper(minAdmins);
