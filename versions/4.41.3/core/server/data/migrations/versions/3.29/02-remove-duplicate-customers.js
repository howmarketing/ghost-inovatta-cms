const logging = require('@tryghost/logging');
const DatabaseInfo = require('@tryghost/database-info');

module.exports = {
    config: {
        transaction: true
    },

    async up({transacting: knex}) {
        if (!DatabaseInfo.isMySQL(knex)) {
            logging.warn('Skipping cleanup of duplicate customers - database is not MySQL');
            return;
        }

        const duplicates = await knex('members_stripe_customers')
            .select('customer_id')
            .count('customer_id as count')
            .groupBy('customer_id')
            .having('count', '>', 1);

        if (!duplicates.length) {
            logging.info('No duplicate customers found');
            return;
        }

        logging.info(`Found ${duplicates.length} duplicate stripe customers`);
        // eslint-disable-next-line no-restricted-syntax
        for (const duplicate of duplicates) {
            const customers = await knex('members_stripe_customers')
                .select()
                .where('customer_id', duplicate.customer_id);

            const orderedCustomers = customers.sort((subA, subB) => {
                return subB.updated_at - subA.updated_at;
            });

            const [newestCustomer, ...olderCustomers] = orderedCustomers;

            logging.info(`Keeping newest customer ${newestCustomer.id} - ${newestCustomer.customer_id}, last updated at ${newestCustomer.updated_at}`);

            // eslint-disable-next-line no-restricted-syntax
            for (const customerToDelete of olderCustomers) {
                logging.info(`Deleting duplicate customer ${customerToDelete.id} - ${customerToDelete.customer_id}, last updated at ${customerToDelete.updated_at}`);
                await knex('members_stripe_customers')
                    .where({id: customerToDelete.id})
                    .del();
            }
        }
    },

    // noop for down
    async down() {}
};
