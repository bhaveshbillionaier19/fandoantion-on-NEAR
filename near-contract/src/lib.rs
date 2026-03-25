use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LazyOption, LookupMap, UnorderedSet, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json::json;
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, Gas,
    NearToken, PanicOnDefault, Promise, PromiseOrValue,
};
use std::collections::HashMap;

const GAS_FOR_WITHDRAW_CALLBACK: Gas = Gas::from_tgas(10);
const DEFAULT_LIST_LIMIT: u64 = 20;
const DEFAULT_PREVIEW_LIMIT: u64 = 3;
const MAX_LIST_LIMIT: u64 = 100;
const MAX_TITLE_LEN: usize = 120;
const MAX_DESCRIPTION_LEN: usize = 1000;
const MAX_MEDIA_LEN: usize = 512;
const MAX_REFERENCE_LEN: usize = 512;

#[allow(dead_code)]
#[ext_contract(ext_self)]
trait WithdrawCallback {
    fn on_withdraw_complete(&mut self, creator_id: AccountId, amount: U128) -> bool;
}

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    NonFungibleToken,
    TokenMetadata,
    Enumeration,
    ContractMetadata,
    CreatorIds,
    CreatorTokenIds,
    CreatorTokenIdsInner { account_hash: [u8; 32] },
    TokenCreators,
    CreatorDonations,
    CreatorDonationsInner { account_hash: [u8; 32] },
    CreatorTotals,
    CreatorWithdrawable,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct DonationRecord {
    donor_id: AccountId,
    amount_yocto: u128,
    timestamp_ms: u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct DonationView {
    pub donor_id: AccountId,
    pub amount: U128,
    pub timestamp_ms: u64,
}

impl From<DonationRecord> for DonationView {
    fn from(value: DonationRecord) -> Self {
        Self {
            donor_id: value.donor_id,
            amount: U128(value.amount_yocto),
            timestamp_ms: value.timestamp_ms,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct NftView {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub creator_id: AccountId,
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub reference: Option<String>,
    pub issued_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct CreatorView {
    pub creator_id: AccountId,
    pub total_donations: U128,
    pub withdrawable_balance: U128,
    pub donation_count: u64,
    pub nft_count: u64,
    pub recent_nfts: Vec<NftView>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct DonorTotalView {
    pub donor_id: AccountId,
    pub total_amount: U128,
    pub donation_count: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct FanDonationContract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    next_token_id: u64,
    creator_ids: UnorderedSet<AccountId>,
    creator_token_ids: LookupMap<AccountId, Vector<TokenId>>,
    token_creators: LookupMap<TokenId, AccountId>,
    creator_donations: LookupMap<AccountId, Vector<DonationRecord>>,
    creator_totals: LookupMap<AccountId, u128>,
    creator_withdrawable: LookupMap<AccountId, u128>,
}

#[near]
impl FanDonationContract {
    #[init]
    pub fn new() -> Self {
        let metadata = NFTContractMetadata {
            spec: "nft-1.0.0".to_string(),
            name: "Fan Donation Collectibles".to_string(),
            symbol: "FAN".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        };

        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                env::current_account_id(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                None::<StorageKey>,
            ),
            metadata: LazyOption::new(StorageKey::ContractMetadata, Some(&metadata)),
            next_token_id: 0,
            creator_ids: UnorderedSet::new(StorageKey::CreatorIds),
            creator_token_ids: LookupMap::new(StorageKey::CreatorTokenIds),
            token_creators: LookupMap::new(StorageKey::TokenCreators),
            creator_donations: LookupMap::new(StorageKey::CreatorDonations),
            creator_totals: LookupMap::new(StorageKey::CreatorTotals),
            creator_withdrawable: LookupMap::new(StorageKey::CreatorWithdrawable),
        }
    }

    #[payable]
    pub fn mint_nft(
        &mut self,
        title: String,
        description: String,
        media: String,
        reference: Option<String>,
    ) -> NftView {
        let creator_id = env::predecessor_account_id();
        let storage_before = env::storage_usage();

        let metadata = TokenMetadata {
            title: Some(Self::validated_required_string(title, "Title", MAX_TITLE_LEN)),
            description: Some(Self::validated_required_string(
                description,
                "Description",
                MAX_DESCRIPTION_LEN,
            )),
            media: Some(Self::validated_required_string(media, "Media URL", MAX_MEDIA_LEN)),
            reference: Self::validated_optional_string(reference, "Reference URL", MAX_REFERENCE_LEN),
            issued_at: Some(env::block_timestamp_ms().to_string()),
            ..Default::default()
        };

        let token_id = format!("{}:{}", creator_id, self.next_token_id);
        self.next_token_id += 1;

        let token = self
            .tokens
            .internal_mint(token_id.clone(), creator_id.clone(), Some(metadata));

        let mut creator_tokens = self
            .creator_token_ids
            .get(&creator_id)
            .unwrap_or_else(|| self.creator_token_vector(&creator_id));
        creator_tokens.push(&token_id);
        self.creator_token_ids.insert(&creator_id, &creator_tokens);
        self.token_creators.insert(&token_id, &creator_id);
        self.creator_ids.insert(&creator_id);
        self.refund_unused_attached_deposit(storage_before);

        self.log_event(
            "nft_mint",
            json!({
                "creator_id": creator_id,
                "token_id": token_id,
            }),
        );

        self.token_to_view(token).expect("Minted token must be readable.")
    }

    #[payable]
    pub fn donate(&mut self, creator_id: AccountId) -> DonationView {
        require!(
            self.creator_ids.contains(&creator_id),
            "Creator not found. Mint an NFT before receiving donations."
        );

        let donor_id = env::predecessor_account_id();
        let storage_before = env::storage_usage();
        let mut donations = self
            .creator_donations
            .get(&creator_id)
            .unwrap_or_else(|| self.creator_donation_vector(&creator_id));

        let pending_record = DonationRecord {
            donor_id: donor_id.clone(),
            amount_yocto: 0,
            timestamp_ms: env::block_timestamp_ms(),
        };
        donations.push(&pending_record);

        let storage_used = env::storage_usage().saturating_sub(storage_before);
        let storage_cost = Self::storage_cost(storage_used);
        let attached_deposit = env::attached_deposit().as_yoctonear();
        require!(
            attached_deposit > storage_cost,
            format!(
                "Attach more than {} yoctoNEAR to cover receipt storage and include a positive donation.",
                storage_cost
            )
        );

        let donation_amount = attached_deposit - storage_cost;
        let finalized_record = DonationRecord {
            amount_yocto: donation_amount,
            ..pending_record
        };
        let last_index = donations
            .len()
            .checked_sub(1)
            .expect("Donation receipt index must exist.");
        donations.replace(last_index, &finalized_record);
        self.creator_donations.insert(&creator_id, &donations);
        self.credit_creator_balance(&creator_id, donation_amount);

        self.log_event(
            "donation",
            json!({
                "creator_id": creator_id,
                "donor_id": donor_id,
                "amount": donation_amount.to_string(),
            }),
        );

        finalized_record.into()
    }

    pub fn get_creator(&self, creator_id: AccountId) -> Option<CreatorView> {
        if !self.creator_ids.contains(&creator_id) {
            return None;
        }

        Some(self.to_creator_view(&creator_id))
    }

    pub fn list_creators(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<CreatorView> {
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT);

        self.creator_ids
            .iter()
            .skip(start as usize)
            .take(limit as usize)
            .map(|creator_id| self.to_creator_view(&creator_id))
            .collect()
    }

    pub fn get_total_donations(&self, creator_id: AccountId) -> U128 {
        U128(self.creator_totals.get(&creator_id).unwrap_or(0))
    }

    pub fn get_withdrawable_balance(&self, creator_id: AccountId) -> U128 {
        U128(self.creator_withdrawable.get(&creator_id).unwrap_or(0))
    }

    pub fn get_donations(
        &self,
        creator_id: AccountId,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<DonationView> {
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT);

        self.creator_donations
            .get(&creator_id)
            .map(|donations| {
                donations
                    .iter()
                    .skip(start as usize)
                    .take(limit as usize)
                    .map(Into::into)
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_top_donors(&self, creator_id: AccountId, limit: Option<u64>) -> Vec<DonorTotalView> {
        let mut aggregate: HashMap<AccountId, (u128, u64)> = HashMap::new();
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT) as usize;

        if let Some(donations) = self.creator_donations.get(&creator_id) {
            for donation in donations.iter() {
                let entry = aggregate.entry(donation.donor_id.clone()).or_insert((0, 0));
                entry.0 += donation.amount_yocto;
                entry.1 += 1;
            }
        }

        let mut donors: Vec<_> = aggregate
            .into_iter()
            .map(|(donor_id, (total_amount, donation_count))| DonorTotalView {
                donor_id,
                total_amount: U128(total_amount),
                donation_count,
            })
            .collect();
        donors.sort_by(|left, right| right.total_amount.0.cmp(&left.total_amount.0));
        donors.truncate(limit);
        donors
    }

    pub fn get_nfts_by_creator(
        &self,
        creator_id: AccountId,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<NftView> {
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(DEFAULT_LIST_LIMIT).min(MAX_LIST_LIMIT);

        self.creator_token_ids
            .get(&creator_id)
            .map(|token_ids| {
                token_ids
                    .iter()
                    .skip(start as usize)
                    .take(limit as usize)
                    .filter_map(|token_id| self.nft_view(&token_id))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_nfts_by_owner(
        &self,
        owner_id: AccountId,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<NftView> {
        self.tokens
            .nft_tokens_for_owner(owner_id, from_index.map(|index| U128(u128::from(index))), limit)
            .into_iter()
            .filter_map(|token| self.token_to_view(token))
            .collect()
    }

    #[payable]
    pub fn withdraw(&mut self) -> Promise {
        assert_one_yocto();

        let creator_id = env::predecessor_account_id();
        let amount = self.creator_withdrawable.get(&creator_id).unwrap_or(0);
        require!(amount > 0, "There is no withdrawable balance for this creator.");

        self.creator_withdrawable.insert(&creator_id, &0);

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
        if env::promise_result_checked(0, 0).is_ok() {
            return true;
        }

        let restored_balance = self.creator_withdrawable.get(&creator_id).unwrap_or(0) + amount.0;
        self.creator_withdrawable.insert(&creator_id, &restored_balance);
        false
    }
}

near_contract_standards::impl_non_fungible_token_core!(FanDonationContract, tokens);
near_contract_standards::impl_non_fungible_token_enumeration!(FanDonationContract, tokens);

#[near]
impl NonFungibleTokenMetadataProvider for FanDonationContract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().expect("Contract metadata should exist.")
    }
}

impl FanDonationContract {
    fn to_creator_view(&self, creator_id: &AccountId) -> CreatorView {
        let recent_nfts = self
            .creator_token_ids
            .get(creator_id)
            .map(|token_ids| {
                let len = token_ids.len();
                let start = len.saturating_sub(DEFAULT_PREVIEW_LIMIT);
                (start..len)
                    .rev()
                    .filter_map(|index| token_ids.get(index))
                    .filter_map(|token_id| self.nft_view(&token_id))
                    .collect()
            })
            .unwrap_or_default();

        let donation_count = self
            .creator_donations
            .get(creator_id)
            .map(|donations| donations.len())
            .unwrap_or(0);
        let nft_count = self
            .creator_token_ids
            .get(creator_id)
            .map(|token_ids| token_ids.len())
            .unwrap_or(0);

        CreatorView {
            creator_id: creator_id.clone(),
            total_donations: U128(self.creator_totals.get(creator_id).unwrap_or(0)),
            withdrawable_balance: U128(self.creator_withdrawable.get(creator_id).unwrap_or(0)),
            donation_count,
            nft_count,
            recent_nfts,
        }
    }

    fn creator_token_vector(&self, creator_id: &AccountId) -> Vector<TokenId> {
        Vector::new(StorageKey::CreatorTokenIdsInner {
            account_hash: env::sha256_array(creator_id.as_bytes()),
        })
    }

    fn creator_donation_vector(&self, creator_id: &AccountId) -> Vector<DonationRecord> {
        Vector::new(StorageKey::CreatorDonationsInner {
            account_hash: env::sha256_array(creator_id.as_bytes()),
        })
    }

    fn credit_creator_balance(&mut self, creator_id: &AccountId, donation_amount: u128) {
        let next_total = self.creator_totals.get(creator_id).unwrap_or(0) + donation_amount;
        let next_withdrawable = self.creator_withdrawable.get(creator_id).unwrap_or(0) + donation_amount;
        self.creator_totals.insert(creator_id, &next_total);
        self.creator_withdrawable.insert(creator_id, &next_withdrawable);
        self.creator_ids.insert(creator_id);
    }

    fn nft_view(&self, token_id: &TokenId) -> Option<NftView> {
        self.tokens
            .nft_token(token_id.clone())
            .and_then(|token| self.token_to_view(token))
    }

    fn token_to_view(&self, token: Token) -> Option<NftView> {
        let creator_id = self.token_creators.get(&token.token_id)?;
        let metadata = token.metadata.unwrap_or_default();
        Some(NftView {
            token_id: token.token_id,
            owner_id: token.owner_id,
            creator_id,
            title: metadata.title,
            description: metadata.description,
            media: metadata.media,
            reference: metadata.reference,
            issued_at: metadata.issued_at,
        })
    }

    fn refund_unused_attached_deposit(&self, storage_before: u64) {
        let attached_deposit = env::attached_deposit().as_yoctonear();
        let storage_used = env::storage_usage().saturating_sub(storage_before);
        let storage_cost = Self::storage_cost(storage_used);

        require!(
            attached_deposit >= storage_cost,
            format!(
                "Attach at least {} yoctoNEAR to cover the storage added by this transaction.",
                storage_cost
            )
        );

        let refund = attached_deposit - storage_cost;
        if refund > 0 {
            Promise::new(env::predecessor_account_id())
                .transfer(NearToken::from_yoctonear(refund))
                .detach();
        }
    }

    fn storage_cost(bytes_used: u64) -> u128 {
        env::storage_byte_cost().as_yoctonear() * u128::from(bytes_used)
    }

    fn validated_required_string(value: String, field_name: &str, max_len: usize) -> String {
        let cleaned = value.trim().to_string();
        require!(!cleaned.is_empty(), format!("{field_name} cannot be empty."));
        require!(
            cleaned.len() <= max_len,
            format!("{field_name} must be at most {max_len} characters."),
        );
        cleaned
    }

    fn validated_optional_string(
        value: Option<String>,
        field_name: &str,
        max_len: usize,
    ) -> Option<String> {
        value.and_then(|item| {
            let cleaned = item.trim().to_string();
            if cleaned.is_empty() {
                return None;
            }

            require!(
                cleaned.len() <= max_len,
                format!("{field_name} must be at most {max_len} characters."),
            );
            Some(cleaned)
        })
    }

    fn log_event(&self, event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({
                "standard": "fandonation",
                "version": "1.0.0",
                "event": event,
                "data": [data],
            })
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, PromiseResult, RuntimeFeesConfig};
    use std::collections::HashMap;

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
    fn mints_nft_and_indexes_creator() {
        let builder = context("creator.testnet", 1);
        testing_env!(builder.build());

        let mut contract = FanDonationContract::new();
        let minted = contract.mint_nft(
            "Genesis".to_string(),
            "First collectible".to_string(),
            "ipfs://image".to_string(),
            Some("ipfs://metadata".to_string()),
        );

        assert_eq!(minted.creator_id, account("creator.testnet"));
        assert_eq!(minted.owner_id, account("creator.testnet"));
        assert_eq!(contract.get_nfts_by_creator(account("creator.testnet"), None, None).len(), 1);
        assert_eq!(contract.get_nfts_by_owner(account("creator.testnet"), None, None).len(), 1);
    }

    #[test]
    fn stores_donations_and_restores_failed_withdraw() {
        let mut builder = context("creator.testnet", 1);
        testing_env!(builder.build());

        let mut contract = FanDonationContract::new();
        contract.mint_nft(
            "Genesis".to_string(),
            "First collectible".to_string(),
            "ipfs://image".to_string(),
            Some("ipfs://metadata".to_string()),
        );

        builder = context("donor.testnet", 3);
        testing_env!(builder.build());
        let donation = contract.donate(account("creator.testnet"));
        assert!(donation.amount.0 > 0);
        assert_eq!(contract.get_total_donations(account("creator.testnet")).0, donation.amount.0);
        assert_eq!(contract.get_donations(account("creator.testnet"), None, None).len(), 1);

        builder = context("creator.testnet", 0);
        builder.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(builder.build());
        let _ = contract.withdraw();
        assert_eq!(contract.get_withdrawable_balance(account("creator.testnet")).0, 0);

        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            RuntimeFeesConfig::test(),
            HashMap::default(),
            vec![PromiseResult::Failed],
        );
        contract.on_withdraw_complete(account("creator.testnet"), U128(donation.amount.0));

        assert_eq!(
            contract.get_withdrawable_balance(account("creator.testnet")).0,
            donation.amount.0
        );
    }
}





