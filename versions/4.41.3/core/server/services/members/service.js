const _ = require('lodash');
const errors = require('@tryghost/errors');
const tpl = require('@tryghost/tpl');
const MembersSSR = require('@tryghost/members-ssr');
const db = require('../../data/db');
const MembersConfigProvider = require('./config');
const MembersCSVImporter = require('@tryghost/members-importer');
const MembersStats = require('./stats/members-stats');
const createMembersSettingsInstance = require('./settings');
const logging = require('@tryghost/logging');
const urlUtils = require('../../../shared/url-utils');
const labsService = require('../../../shared/labs');
const settingsCache = require('../../../shared/settings-cache');
const config = require('../../../shared/config');
const models = require('../../models');
const {GhostMailer} = require('../mail');
const jobsService = require('../jobs');
const VerificationTrigger = require('@tryghost/verification-trigger');
const DomainEvents = require('@tryghost/domain-events');
const {LastSeenAtUpdater} = require('@tryghost/members-events-service');
const events = require('../../lib/common/events');

const messages = {
    noLiveKeysInDevelopment: 'Cannot use live stripe keys in development. Please restart in production mode.',
    sslRequiredForStripe: 'Cannot run Ghost without SSL when Stripe is connected. Please update your url config to use "https://".',
    remoteWebhooksInDevelopment: 'Cannot use remote webhooks in development. See https://ghost.org/docs/webhooks/#stripe-webhooks for developing with Stripe.'
};

const ghostMailer = new GhostMailer();

const membersConfig = new MembersConfigProvider({
    config,
    settingsCache,
    urlUtils
});

const membersStats = new MembersStats({
    db: db,
    settingsCache: settingsCache,
    isSQLite: config.get('database:client') === 'sqlite3'
});

let membersApi;
let membersSettings;
let verificationTrigger;

const membersImporter = new MembersCSVImporter({
    storagePath: config.getContentPath('data'),
    getTimezone: () => settingsCache.get('timezone'),
    getMembersApi: () => module.exports.api,
    sendEmail: ghostMailer.send.bind(ghostMailer),
    isSet: labsService.isSet.bind(labsService),
    addJob: jobsService.addJob.bind(jobsService),
    knex: db.knex,
    urlFor: urlUtils.urlFor.bind(urlUtils)
});

const processImport = async (options) => {
    const result = await membersImporter.process(options);
    const importSize = result.meta.originalImportSize;
    delete result.meta.originalImportSize;

    const importThreshold = await verificationTrigger.getImportThreshold();
    if (importSize > importThreshold) {
        await verificationTrigger.startVerificationProcess({
            amountImported: importSize,
            throwOnTrigger: true,
            source: 'import'
        });
    }

    return result;
};

module.exports = {
    async init() {
        const stripeService = require('../stripe');
        const createMembersApiInstance = require('./api');
        const env = config.get('env');

        events.on('settings.edited', async function (settingModel) {
            if (labsService.isSet('multipleProducts')) {
                return;
            }

            const key = settingModel.get('key');
            const value = settingModel.get('value');

            if (key === 'members_free_signup_redirect') {
                try {
                    await models.Product.forge().query().update('welcome_page_url', value).where('type', 'free');
                } catch (err) {
                    logging.error(err);
                }
                return;
            }
            if (key === 'members_paid_signup_redirect') {
                try {
                    await models.Product.forge().query().update('welcome_page_url', value).where('type', 'paid');
                } catch (err) {
                    logging.error(err);
                }
                return;
            }
        });

        // @TODO Move to stripe service
        if (env !== 'production') {
            if (stripeService.api.configured && stripeService.api.mode === 'live') {
                throw new errors.IncorrectUsageError({
                    message: tpl(messages.noLiveKeysInDevelopment)
                });
            }
        } else {
            const siteUrl = urlUtils.getSiteUrl();
            if (!/^https/.test(siteUrl) && stripeService.api.configured) {
                throw new errors.IncorrectUsageError({
                    message: tpl(messages.sslRequiredForStripe)
                });
            }
        }
        if (!membersApi) {
            membersApi = createMembersApiInstance(membersConfig);

            membersApi.bus.on('error', function (err) {
                logging.error(err);
            });
        }

        module.exports.ssr = MembersSSR({
            cookieSecure: urlUtils.isSSL(urlUtils.getSiteUrl()),
            cookieKeys: [settingsCache.get('theme_session_secret')],
            cookieName: 'ghost-members-ssr',
            getMembersApi: () => module.exports.api
        });

        verificationTrigger = new VerificationTrigger({
            configThreshold: _.get(config.get('hostSettings'), 'emailVerification.importThreshold'),
            isVerified: () => config.get('hostSettings:emailVerification:verified') === true,
            isVerificationRequired: () => settingsCache.get('email_verification_required') === true,
            sendVerificationEmail: ({subject, message, amountImported}) => {
                const escalationAddress = config.get('hostSettings:emailVerification:escalationAddress');
                const fromAddress = config.get('user_email');

                if (escalationAddress) {
                    ghostMailer.send({
                        subject,
                        html: tpl(message, {
                            importedNumber: amountImported,
                            siteUrl: urlUtils.getSiteUrl()
                        }),
                        forceTextContent: true,
                        from: fromAddress,
                        to: escalationAddress
                    });
                }
            },
            membersStats,
            Settings: models.Settings,
            eventRepository: membersApi.events
        });

        new LastSeenAtUpdater({
            models: {
                Member: models.Member
            },
            services: {
                domainEvents: DomainEvents,
                settingsCache
            }
        });

        (async () => {
            try {
                const collection = await models.SingleUseToken.fetchAll();
                await collection.invokeThen('destroy');
            } catch (err) {
                logging.error(err);
            }
        })();

        try {
            await stripeService.migrations.execute();
        } catch (err) {
            logging.error(err);
        }
    },
    contentGating: require('./content-gating'),

    config: membersConfig,

    get api() {
        return membersApi;
    },

    get settings() {
        if (!membersSettings) {
            membersSettings = createMembersSettingsInstance(membersConfig);
        }
        return membersSettings;
    },

    ssr: null,

    stripeConnect: require('./stripe-connect'),

    processImport: processImport,

    stats: membersStats

};
module.exports.middleware = require('./middleware');
