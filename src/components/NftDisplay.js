import React from "react";

const Trait = ({ name, value }) => {
  return (
    <div className="bg-purple-100 rounded-md p-2 text-center">
      <p className="text-xs text-gray-600">{name}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
};

const NftDisplay = ({ metadata }) => {
  if (!metadata) {
    return null;
  }

  // Get the image URL from metadata
  const imageUrl = metadata.animation_url || metadata.image;

  // Extract traits/attributes if they exist
  const traits =
    metadata.attributes?.filter(
      (attr) => attr.trait_type && attr.value !== undefined
    ) || [];

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="relative aspect-square w-full">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={metadata.name || "NFT"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image available</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          {metadata.name || "Unnamed NFT"}
        </h3>

        {metadata.description && (
          <p className="text-sm text-gray-600 mb-4">{metadata.description}</p>
        )}

        {traits.length > 0 && (
          <>
            <hr className="my-4" />
            <div className="grid grid-cols-3 gap-2">
              {traits.map((trait, index) => (
                <Trait
                  key={index}
                  name={trait.trait_type}
                  value={trait.value}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Component to display the most recently minted NFT
export const MintedNftDisplay = ({ nfts }) => {
  if (!nfts || nfts.length === 0) {
    return null;
  }

  // Get the most recently minted NFT
  const latestNft = nfts[nfts.length - 1];

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Your Minted NFT</h2>
      <NftDisplay metadata={latestNft.offChainMetadata} />
    </div>
  );
};

export default NftDisplay;
