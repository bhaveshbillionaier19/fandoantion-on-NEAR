use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedSet, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, Gas,
    NearToken, PanicOnDefault, Promise, PromiseResult,
};

const GAS_FOR_WITHDRAW_CALLBACK: Gas = Gas::from_tgas(10);
const MAX_DISPLAY_NAME_LEN: usize = 64;
const MAX_BIO_LEN: usize = 280;
const MAX_IMAGE_URL_LEN: usize = 512;
const MAX_MESSAGE_LEN: usize = 280;
const DEFAULT_RECENT_DONATIONS_LIMIT: u64 = 3;
const DEFAULT_LIST_LIMIT: u64 = 20;
const MAX_LIST_LIMIT: u64 = 100;

#[ext_contract(ext_self)]
trait WithdrawCallback {
    fn on_withdraw_complete(&mut self, creator_id: AccountId, amount: U128) -> bool;
}

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    CreatorIds,
    Creators,
    CreatorDonations { account_hash: [u8; 32] },
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct CreatorProfile {
    display_name: String,
    bio: Option<String>,
    image_url: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct DonationRecord {
    donor_id: AccountId,
    amount_yocto: u128,
    timestamp_ms: u64,
    message: Option<String>,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct CreatorAccount {
    profile: CreatorProfile,
    total_donations_yocto: u128,
    withdrawable_balance_yocto: u128,
    donations: Vector<DonationRecord>,
}

impl CreatorAccount {
    fn new(creator_id: &AccountId, profile: CreatorProfile) -> Self {
        Self {
            profile,
            total_donations_yocto: 0,
            withdrawable_balance_yocto: 0,
            donations: Vector::new(StorageKey::CreatorDonations {
                account_hash: env::sha256_array(creator_id.as_bytes()),
            }),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct DonationView {
    pub donor_id: AccountId,
    pub amount: U128,
    pub timestamp_ms: u64,
    pub message: Option<String>,
}

impl From<DonationRecord> for DonationView {
    fn from(value: DonationRecord) -> Self {
        Self {
            donor_id: value.donor_id,
            amount: U128(value.amount_yocto),
            timestamp_ms: value.timestamp_ms,
            message: value.message,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct CreatorView {
    pub creator_id: AccountId,
    pub display_name: String,
    pub bio: Option<String>,
    pub image_url: Option<String>,
    pub total_donations: U128,
    pub withdrawable_balance: U128,
    pub donation_count: u64,
    pub recent_donations: Vec<DonationView>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct FanDonationContract {
    creator_ids: UnorderedSet<AccountId>,
    creators: LookupMap<AccountId, CreatorAccount>,
}

#[near]
impl FanDonationContract {
    #[init]
    pub fn new() -> Self {
        Self {
            creator_ids: UnorderedSet::new(StorageKey::CreatorIds),
            creators: LookupMap::new(StorageKey::Creators),
        }
    }

    #[payable]
    pub fn set_profile(
        &mut self,
        display_name: String,
        bio: Option<String>,
        image_url: Option<String>,
    ) -> CreatorView {
        let creator_id = env::predecessor_account_id();
        let storage_before = env::storage_usage();
        let profile = Self::validated_profile(display_name, bio, image_url);

        let mut creator = self
            .creators
            .get(&creator_id)
            .unwrap_or_else(|| CreatorAccount::new(&creator_id, profile.clone()));

        creator.profile = profile;
        self.creators.insert(&creator_id, &creator);
        self.creator_ids.insert(&creator_id);
        self.refund_unused_attached_deposit(storage_before);

        self.get_creator(creator_id)
            .expect("Creator profile must exist after saving.")
    }

    #[payable]
    pub fn donate(&mut self, creator_id: AccountId, message: Option<String>) -> DonationView {
        let donor_id = env::predecessor_account_id();
        let mut creator = self.expect_creator(&creator_id);
        let cleaned_message = Self::validated_message(message);

        let storage_before = env::storage_usage();
        let pending_record = DonationRecord {
            donor_id: donor_id.clone(),
            amount_yocto: 0,
            timestamp_ms: env::block_timestamp_ms(),
            message: cleaned_message,
        };

        creator.donations.push(&pending_record);
        let additional_storage_bytes = env::storage_usage().saturating_sub(storage_before);
        let storage_cost = Self::storage_cost(additional_storage_bytes);
        let attached_deposit = env::attached_deposit().as_yoctonear();

        require!(
            attached_deposit > storage_cost,
            format!(
                "Attach more than {} yoctoNEAR to cover receipt storage and a positive donation.",
                storage_cost
            )
        );

        let donation_amount = attached_deposit - storage_cost;
        let finalized_record = DonationRecord {
            amount_yocto: donation_amount,
            ..pending_record
        };
        let last_index = creator
            .donations
            .len()
            .checked_sub(1)
            .expect("Donation receipt index must exist.");
        creator.donations.replace(last_index, &finalized_record);
        creator.total_donations_yocto += donation_amount;
        creator.withdrawable_balance_yocto += donation_amount;
        self.creators.insert(&creator_id, &creator);

        finalized_record.into()
    }

    pub fn get_donations(&self, creator_id: AccountId) -> Vec<DonationView> {
        self.expect_creator(&creator_id)
            .donations
            .iter()
            .map(Into::into)
            .collect()
    }

    pub fn get_donations_paginated(
        &self,
        creator_id: AccountId,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<DonationView> {
        let creator = self.expect_creator(&creator_id);
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT);

        creator
            .donations
            .iter()
            .skip(start as usize)
            .take(limit as usize)
            .map(Into::into)
            .collect()
    }

    pub fn get_total_donations(&self, creator_id: AccountId) -> U128 {
        U128(self.expect_creator(&creator_id).total_donations_yocto)
    }

    pub fn get_withdrawable_balance(&self, creator_id: AccountId) -> U128 {
        U128(self.expect_creator(&creator_id).withdrawable_balance_yocto)
    }

    pub fn get_creator(&self, creator_id: AccountId) -> Option<CreatorView> {
        self.creators
            .get(&creator_id)
            .map(|creator| self.to_creator_view(creator_id, creator))
    }

    pub fn list_creators(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<CreatorView> {
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT);

        self.creator_ids
            .iter()
            .skip(start as usize)
            .take(limit as usize)
            .filter_map(|creator_id| {
                self.creators
                    .get(&creator_id)
                    .map(|creator| self.to_creator_view(creator_id, creator))
            })
            .collect()
    }

    #[payable]
    pub fn withdraw(&mut self) -> Promise {
        assert_one_yocto();

        let creator_id = env::predecessor_account_id();
        let mut creator = self.expect_creator(&creator_id);
        let amount = creator.withdrawable_balance_yocto;

        require!(amount > 0, "There is no withdrawable balance for this creator.");

        creator.withdrawable_balance_yocto = 0;
        self.creators.insert(&creator_id, &creator);

        Promise::new(creator_id.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_WITHDRAW_CALLBACK)
                    .on_withdraw_complete(creator_id, U128(amount)),
            )
    }

    #[private]
    pub fn on_withdraw_complete(&mut self, creator_id: AccountId, amount: U128) -> bool {
        match env::promise_result(0) {
            PromiseResult::Successful(_) => true,
            _ => {
                let mut creator = self.expect_creator(&creator_id);
                creator.withdrawable_balance_yocto += amount.0;
                self.creators.insert(&creator_id, &creator);
                false
            }
        }
    }
}

impl FanDonationContract {
    fn to_creator_view(&self, creator_id: AccountId, creator: CreatorAccount) -> CreatorView {
        CreatorView {
            creator_id,
            display_name: creator.profile.display_name,
            bio: creator.profile.bio,
            image_url: creator.profile.image_url,
            total_donations: U128(creator.total_donations_yocto),
            withdrawable_balance: U128(creator.withdrawable_balance_yocto),
            donation_count: creator.donations.len(),
            recent_donations: Self::recent_donations(&creator.donations),
        }
    }

    fn expect_creator(&self, creator_id: &AccountId) -> CreatorAccount {
        self.creators
            .get(creator_id)
            .unwrap_or_else(|| env::panic_str("Creator profile not found. The creator must register first."))
    }

    fn refund_unused_attached_deposit(&self, storage_before: u64) {
        let attached_deposit = env::attached_deposit().as_yoctonear();
        let storage_used = env::storage_usage().saturating_sub(storage_before);
        let storage_cost = Self::storage_cost(storage_used);

        require!(
            attached_deposit >= storage_cost,
            format!(
                "Attach at least {} yoctoNEAR to cover the profile storage that was added.",
                storage_cost
            )
        );

        let refund = attached_deposit - storage_cost;
        if refund > 0 {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(refund));
        }
    }

    fn storage_cost(bytes_used: u64) -> u128 {
        env::storage_byte_cost().as_yoctonear() * u128::from(bytes_used)
    }

    fn recent_donations(donations: &Vector<DonationRecord>) -> Vec<DonationView> {
        let len = donations.len();
        let start = len.saturating_sub(DEFAULT_RECENT_DONATIONS_LIMIT);

        (start..len)
            .rev()
            .filter_map(|index| donations.get(index))
            .map(Into::into)
            .collect()
    }

    fn validated_profile(
        display_name: String,
        bio: Option<String>,
        image_url: Option<String>,
    ) -> CreatorProfile {
        let cleaned_display_name = display_name.trim().to_string();
        require!(
            !cleaned_display_name.is_empty(),
            "Display name cannot be empty."
        );
        require!(
            cleaned_display_name.len() <= MAX_DISPLAY_NAME_LEN,
            format!("Display name must be at most {} characters.", MAX_DISPLAY_NAME_LEN)
        );

        let cleaned_bio = Self::normalize_optional_string(bio);
        if let Some(value) = cleaned_bio.as_ref() {
            require!(
                value.len() <= MAX_BIO_LEN,
                format!("Bio must be at most {} characters.", MAX_BIO_LEN)
            );
        }

        let cleaned_image_url = Self::normalize_optional_string(image_url);
        if let Some(value) = cleaned_image_url.as_ref() {
            require!(
                value.len() <= MAX_IMAGE_URL_LEN,
                format!("Image URL must be at most {} characters.", MAX_IMAGE_URL_LEN)
            );
        }

        CreatorProfile {
            display_name: cleaned_display_name,
            bio: cleaned_bio,
            image_url: cleaned_image_url,
        }
    }

    fn validated_message(message: Option<String>) -> Option<String> {
        let cleaned_message = Self::normalize_optional_string(message);
        if let Some(value) = cleaned_message.as_ref() {
            require!(
                value.len() <= MAX_MESSAGE_LEN,
                format!("Donation message must be at most {} characters.", MAX_MESSAGE_LEN)
            );
        }

        cleaned_message
    }

    fn normalize_optional_string(value: Option<String>) -> Option<String> {
        value.and_then(|item| {
            let cleaned = item.trim().to_string();
            if cleaned.is_empty() {
                None
            } else {
                Some(cleaned)
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn account(value: &str) -> AccountId {
        value.parse().unwrap()
    }

    fn context(predecessor: &str, deposit_near: u128) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.current_account_id(account("konigsegg123.testnet"));
        builder.predecessor_account_id(account(predecessor));
        builder.signer_account_id(account(predecessor));
        builder.attached_deposit(NearToken::from_near(deposit_near));
        builder
    }

    #[test]
    fn stores_profile_and_donation_history() {
        let mut builder = context("creator.testnet", 1);
        testing_env!(builder.build());

        let mut contract = FanDonationContract::new();
        contract.set_profile(
            "Creator".to_string(),
            Some("Builds on NEAR".to_string()),
            None,
        );

        builder = context("donor.testnet", 3);
        testing_env!(builder.build());
        let donation = contract.donate(
            account("creator.testnet"),
            Some("Keep shipping".to_string()),
        );

        assert!(donation.amount.0 > 0);
        assert_eq!(
            contract.get_total_donations(account("creator.testnet")).0,
            donation.amount.0
        );

        let history = contract.get_donations(account("creator.testnet"));
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].donor_id, account("donor.testnet"));
        assert_eq!(history[0].message.as_deref(), Some("Keep shipping"));
    }

    #[test]
    fn withdraw_restores_balance_on_failed_callback() {
        let mut builder = context("creator.testnet", 1);
        testing_env!(builder.build());

        let mut contract = FanDonationContract::new();
        contract.set_profile("Creator".to_string(), None, None);

        builder = context("donor.testnet", 2);
        testing_env!(builder.build());
        let donation = contract.donate(account("creator.testnet"), None);

        builder = context("creator.testnet", 0);
        testing_env!(builder.build());
        let before = contract.get_withdrawable_balance(account("creator.testnet")).0;
        assert_eq!(before, donation.amount.0);

        contract.on_withdraw_complete(account("creator.testnet"), U128(donation.amount.0));
        let restored = contract.get_withdrawable_balance(account("creator.testnet")).0;

        assert_eq!(restored, donation.amount.0);
    }
}
