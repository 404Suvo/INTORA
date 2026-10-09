// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ShoppingIntentRegistry
 * @notice Versioned, immutable registry for shopping plan commitments on Base Sepolia.
 * Stores cryptographically verified commitments (keccak256 plan hashes) approved by users.
 * 
 * IMPORTANT NOTICE:
 * This contract records a cryptographic commitment to a user-approved shopping plan.
 * It does not process payments, manage funds, lock escrow, or place real-world commerce orders.
 */
contract ShoppingIntentRegistry {
    // Custom Errors
    error ZeroIntentId();
    error ZeroPlanHash();
    error InvalidVersion();
    error InvalidExpiry();
    error IntentAlreadyExists();
    error IntentDoesNotExist();
    error Unauthorized();
    error IntentCancelledError();
    error VersionNotFound();

    // Structs
    struct IntentRecord {
        address owner;
        uint32 latestVersion;
        bool cancelled;
    }

    struct VersionRecord {
        bytes32 planHash;
        uint64 expiry;
    }

    // State
    // intentId => IntentRecord (owner, latestVersion, cancelled)
    mapping(bytes32 => IntentRecord) private _intents;

    // intentId => version => VersionRecord (planHash, expiry)
    mapping(bytes32 => mapping(uint32 => VersionRecord)) private _versions;

    // Events
    event IntentRecorded(
        bytes32 indexed intentId,
        address indexed owner,
        bytes32 planHash,
        uint32 version,
        uint64 expiry
    );

    event VersionRecorded(
        bytes32 indexed intentId,
        address indexed owner,
        bytes32 planHash,
        uint32 version,
        uint64 expiry
    );

    event IntentCancelled(bytes32 indexed intentId, address indexed owner);

    /**
     * @notice Records the first version (version 1) of a new shopping intent commitment.
     * @param intentId Unique 32-byte identifier for the intent.
     * @param planHash Keccak256 hash of the canonical plan string.
     * @param version Must be exactly 1.
     * @param expiry Unix timestamp in seconds; must be strictly in the future.
     */
    function recordIntent(
        bytes32 intentId,
        bytes32 planHash,
        uint32 version,
        uint64 expiry
    ) external {
        if (intentId == bytes32(0)) revert ZeroIntentId();
        if (planHash == bytes32(0)) revert ZeroPlanHash();
        if (version != 1) revert InvalidVersion();
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (_intents[intentId].owner != address(0)) revert IntentAlreadyExists();

        _intents[intentId] = IntentRecord({
            owner: msg.sender,
            latestVersion: 1,
            cancelled: false
        });

        _versions[intentId][1] = VersionRecord({
            planHash: planHash,
            expiry: expiry
        });

        emit IntentRecorded(intentId, msg.sender, planHash, 1, expiry);
    }

    /**
     * @notice Records an incremental version (version + 1) for an existing intent.
     * Historical versions are immutable and permanently preserved.
     * Revising an intent whose previous version has expired is explicitly permitted.
     * @param intentId Unique 32-byte identifier for the existing intent.
     * @param planHash Keccak256 hash of the canonical amended plan.
     * @param version Must equal the current latestVersion + 1.
     * @param expiry Unix timestamp in seconds; must be strictly in the future.
     */
    function recordVersion(
        bytes32 intentId,
        bytes32 planHash,
        uint32 version,
        uint64 expiry
    ) external {
        if (intentId == bytes32(0)) revert ZeroIntentId();
        if (planHash == bytes32(0)) revert ZeroPlanHash();

        IntentRecord storage record = _intents[intentId];
        if (record.owner == address(0)) revert IntentDoesNotExist();
        if (record.owner != msg.sender) revert Unauthorized();
        if (record.cancelled) revert IntentCancelledError();
        if (version != record.latestVersion + 1) revert InvalidVersion();
        if (expiry <= block.timestamp) revert InvalidExpiry();

        record.latestVersion = version;
        _versions[intentId][version] = VersionRecord({
            planHash: planHash,
            expiry: expiry
        });

        emit VersionRecorded(intentId, msg.sender, planHash, version, expiry);
    }

    /**
     * @notice Permanently cancels an intent. Cancelled intents cannot be revised or revived.
     * @param intentId Unique 32-byte identifier for the intent.
     */
    function cancelIntent(bytes32 intentId) external {
        IntentRecord storage record = _intents[intentId];
        if (record.owner == address(0)) revert IntentDoesNotExist();
        if (record.owner != msg.sender) revert Unauthorized();
        if (record.cancelled) revert IntentCancelledError();

        record.cancelled = true;
        emit IntentCancelled(intentId, msg.sender);
    }

    /**
     * @notice Retrieves commitment details for a given intent and version.
     * @param intentId The 32-byte intent identifier.
     * @param version The version number to query.
     * @return owner The address that owns the intent.
     * @return planHash The cryptographic keccak256 hash of the plan.
     * @return versionOut The confirmed version number.
     * @return expiry The commitment expiry timestamp.
     */
    function getCommitment(
        bytes32 intentId,
        uint32 version
    )
        external
        view
        returns (
            address owner,
            bytes32 planHash,
            uint32 versionOut,
            uint64 expiry
        )
    {
        IntentRecord storage record = _intents[intentId];
        if (record.owner == address(0)) revert IntentDoesNotExist();
        if (version == 0 || version > record.latestVersion) revert VersionNotFound();

        VersionRecord storage v = _versions[intentId][version];
        return (record.owner, v.planHash, version, v.expiry);
    }

    /**
     * @notice Returns the latest version number recorded for an intent. Returns 0 if intent does not exist.
     */
    function getLatestVersion(bytes32 intentId) external view returns (uint32) {
        return _intents[intentId].latestVersion;
    }

    /**
     * @notice Checks if an intent is currently valid.
     * Returns true ONLY if:
     * 1. The intent exists.
     * 2. The intent is not cancelled.
     * 3. The latest recorded version has not expired.
     */
    function isIntentValid(bytes32 intentId) external view returns (bool) {
        IntentRecord storage record = _intents[intentId];
        if (record.owner == address(0) || record.cancelled) return false;

        uint32 latest = record.latestVersion;
        if (latest == 0) return false;

        VersionRecord storage v = _versions[intentId][latest];
        return v.expiry > block.timestamp;
    }
}
