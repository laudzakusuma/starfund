#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, String, Symbol, Vec, Map,
};

const CAMPAIGN_COUNT: Symbol = symbol_short!("CAM_COUNT");

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,
    pub raised: i128,
    pub deadline: u64,
    pub is_active: bool,
    pub withdrawn: bool,
}

#[contracttype]
pub enum DataKey {
    Campaign(u32),
    Contribution(u32, Address),
    Contributors(u32),
}

#[contract]
pub struct StarFundContract;

#[contractimpl]
impl StarFundContract {
    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        goal: i128,
        duration_days: u64,
    ) -> u32 {
        creator.require_auth();

        assert!(goal > 0, "Goal must be positive");
        assert!(duration_days >= 1 && duration_days <= 90, "Duration must be 1-90 days");

        let id: u32 = env.storage().instance().get(&CAMPAIGN_COUNT).unwrap_or(0);
        let next_id = id + 1;

        let deadline = env.ledger().timestamp() + (duration_days * 86_400);

        let campaign = Campaign {
            id: next_id,
            creator,
            title,
            description,
            goal,
            raised: 0,
            deadline,
            is_active: true,
            withdrawn: false,
        };

        env.storage().persistent().set(&DataKey::Campaign(next_id), &campaign);
        env.storage().instance().set(&CAMPAIGN_COUNT, &next_id);

        let contributors: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Contributors(next_id), &contributors);

        env.events().publish(
            (symbol_short!("created"), symbol_short!("campaign")),
            next_id,
        );

        next_id
    }

    pub fn contribute(
        env: Env,
        contributor: Address,
        campaign_id: u32,
        token_address: Address,
        amount: i128,
    ) {
        contributor.require_auth();
        assert!(amount > 0, "Amount must be positive");

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        assert!(campaign.is_active, "Campaign is not active");
        assert!(
            env.ledger().timestamp() <= campaign.deadline,
            "Campaign has expired"
        );

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &contributor,
            &env.current_contract_address(),
            &amount,
        );

        campaign.raised += amount;

        if campaign.raised >= campaign.goal {
            campaign.is_active = false; // soft-close, allow withdrawal
        }

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        let prev: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(campaign_id, contributor.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::Contribution(campaign_id, contributor.clone()),
            &(prev + amount),
        );

        let mut contributors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Contributors(campaign_id))
            .unwrap_or_else(|| Vec::new(&env));

        if !contributors.contains(&contributor) {
            contributors.push_back(contributor.clone());
            env.storage().persistent().set(&DataKey::Contributors(campaign_id), &contributors);
        }

        env.events().publish(
            (symbol_short!("contrib"), symbol_short!("campaign")),
            (campaign_id, contributor, amount),
        );
    }

    pub fn withdraw(
        env: Env,
        campaign_id: u32,
        token_address: Address,
    ) {
        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        campaign.creator.require_auth();

        assert!(!campaign.withdrawn, "Already withdrawn");
        assert!(campaign.raised > 0, "Nothing to withdraw");
        assert!(
            campaign.raised >= campaign.goal || env.ledger().timestamp() > campaign.deadline,
            "Goal not reached and deadline not passed"
        );

        let amount = campaign.raised;
        campaign.withdrawn = true;
        campaign.is_active = false;

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &campaign.creator,
            &amount,
        );

        env.events().publish(
            (symbol_short!("withdraw"), symbol_short!("campaign")),
            (campaign_id, amount),
        );
    }

    pub fn refund(
        env: Env,
        contributor: Address,
        campaign_id: u32,
        token_address: Address,
    ) {
        contributor.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        assert!(
            env.ledger().timestamp() > campaign.deadline && campaign.raised < campaign.goal,
            "Refund not available: deadline not passed or goal reached"
        );

        let contribution: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Contribution(campaign_id, contributor.clone()))
            .expect("No contribution found");

        assert!(contribution > 0, "Nothing to refund");

        env.storage().persistent().set(
            &DataKey::Contribution(campaign_id, contributor.clone()),
            &0i128,
        );

        campaign.raised -= contribution;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &contributor,
            &contribution,
        );
    }

    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found")
    }

    pub fn get_campaign_count(env: Env) -> u32 {
        env.storage().instance().get(&CAMPAIGN_COUNT).unwrap_or(0)
    }

    pub fn get_contribution(env: Env, campaign_id: u32, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(campaign_id, contributor))
            .unwrap_or(0)
    }

    pub fn get_contributors(env: Env, campaign_id: u32) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Contributors(campaign_id))
            .unwrap_or_else(|| Vec::new(&env))
    }
}