// ESLint Override Notice
// This is a valid index.js file - it just exports a lot of stuff!
// Long term we would like to change the API architecture to reduce this file,
// but that's not the problem the index.js max - line eslint "proxy" rule is there to solve.
/* eslint-disable max-lines */

module.exports = {
    get all() {
        return require('./all');
    },

    get default() {
        return require('./default');
    },

    get authentication() {
        return require('./authentication');
    },

    get db() {
        return require('./db');
    },

    get pages() {
        return require('./pages');
    },

    get redirects() {
        return require('./redirects');
    },

    get roles() {
        return require('./roles');
    },

    get slugs() {
        return require('./slugs');
    },

    get schedules() {
        return require('./schedules');
    },

    get webhooks() {
        return require('./webhooks');
    },

    get posts() {
        return require('./posts');
    },

    get settings() {
        return require('./settings');
    },

    get notifications() {
        return require('./notifications');
    },

    get mail() {
        return require('./mail');
    },

    get members() {
        return require('./members');
    },

    get products() {
        return require('./products');
    },

    get tiers() {
        return require('./tiers');
    },

    get member_signin_urls() {
        return require('./member-signin-urls');
    },

    get identities() {
        return require('./identities');
    },

    get images() {
        return require('./images');
    },

    get media() {
        return require('./media');
    },

    get files() {
        return require('./files');
    },

    get users() {
        return require('./users');
    },

    get preview() {
        return require('./preview');
    },

    get email_post() {
        return require('./email-posts');
    },

    get oembed() {
        return require('./oembed');
    },

    get config() {
        return require('./config');
    },

    get themes() {
        return require('./themes');
    },

    get site() {
        return require('./site');
    },

    get email_preview() {
        return require('./email-preview');
    },

    get emails() {
        return require('./emails');
    },

    get snippets() {
        return require('./snippets');
    },

    get custom_theme_settings() {
        return require('./custom-theme-settings');
    },

    get slack() {
        return require('./slack');
    },

    get session() {
        return require('./session');
    },

    get offers() {
        return require('./offers');
    },

    get members_stripe_connect() {
        return require('./members-stripe-connect');
    }
};
