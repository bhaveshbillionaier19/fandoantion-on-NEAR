module donation_contract::Donation {
    use std::string::{String, utf8};
    use std::option;
    use std::signer;
    use aptos_framework::object::{Self, ExtendRef, Object};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::event;
    use aptos_std::table::{Self, Table};
    use aptos_token_objects::collection;
    use aptos_token_objects::token;

    const COLLECTION_NAME: vector<u8> = b"FanDonation Collection";
    const APP_OBJECT_SEED: vector<u8> = b"FanDonationApp";

    struct AppSigner has key {
        extend_ref: ExtendRef,
        total_supply: u64,
        token_addresses: Table<u64, address>,
    }

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct DonationRecord has key {
        total_donations: u64,
        donor_count: u64,
        token_id: u64,
    }

    #[event]
    struct DonationReceived has drop, store {
        donor: address,
        token_address: address,
        token_id: u64,
        amount: u64,
    }

    fun init_module(admin: &signer) {
        let constructor_ref = object::create_named_object(admin, APP_OBJECT_SEED);
        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let app_signer = object::generate_signer(&constructor_ref);

        collection::create_unlimited_collection(
            &app_signer,
            utf8(b"Support your favorite creators through FanDonation NFTs."),
            utf8(COLLECTION_NAME),
            option::none(),
            utf8(b"https://fandonation.example.com/collection.png"),
        );

        move_to(admin, AppSigner {
            extend_ref,
            total_supply: 0,
            token_addresses: table::new(),
        });
    }

    public entry fun mint_nft(
        account: &signer,
        name: String,
        description: String,
        token_uri: String
    ) acquires AppSigner {
        let app_state = borrow_global_mut<AppSigner>(@donation_contract);
        let app_signer = object::generate_signer_for_extending(&app_state.extend_ref);

        let constructor_ref = token::create(
            &app_signer,
            utf8(COLLECTION_NAME),
            description,
            name,
            option::none(),
            token_uri,
        );

        let token_signer = object::generate_signer(&constructor_ref);
        let token_address = signer::address_of(&token_signer);

        app_state.total_supply = app_state.total_supply + 1;
        let token_id = app_state.total_supply;
        table::add(&mut app_state.token_addresses, token_id, token_address);

        move_to(&token_signer, DonationRecord {
            total_donations: 0,
            donor_count: 0,
            token_id,
        });

        let transfer_ref = object::generate_transfer_ref(&constructor_ref);
        let linear_transfer_ref = object::generate_linear_transfer_ref(&transfer_ref);
        object::transfer_with_ref(linear_transfer_ref, signer::address_of(account));
    }

    public entry fun donate(
        account: &signer,
        nft_address: address,
        amount: u64
    ) acquires DonationRecord {
        let nft_obj = object::address_to_object<token::Token>(nft_address);
        let owner = object::owner(nft_obj);
        
        coin::transfer<AptosCoin>(account, owner, amount);

        let record = borrow_global_mut<DonationRecord>(nft_address);
        record.total_donations = record.total_donations + amount;
        record.donor_count = record.donor_count + 1;

        event::emit(DonationReceived {
            donor: signer::address_of(account),
            token_address: nft_address,
            token_id: record.token_id,
            amount,
        });
    }

    #[view]
    public fun total_supply(): u64 acquires AppSigner {
        borrow_global<AppSigner>(@donation_contract).total_supply
    }

    #[view]
    public fun get_token_address(token_id: u64): address acquires AppSigner {
        let app_state = borrow_global<AppSigner>(@donation_contract);
        *table::borrow(&app_state.token_addresses, token_id)
    }

    #[view]
    public fun token_uri(token_id: u64): String acquires AppSigner {
        let token_addr = get_token_address(token_id);
        token::uri(object::address_to_object<token::Token>(token_addr))
    }

    #[view]
    public fun owner_of(token_id: u64): address acquires AppSigner {
        let token_addr = get_token_address(token_id);
        object::owner(object::address_to_object<token::Token>(token_addr))
    }

    #[view]
    public fun total_donations(token_id: u64): u64 acquires AppSigner, DonationRecord {
        let token_addr = get_token_address(token_id);
        borrow_global<DonationRecord>(token_addr).total_donations
    }
}
