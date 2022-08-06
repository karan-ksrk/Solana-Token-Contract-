import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TokenContract } from "../target/types/token_contract";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createInitializeMintInstruction
} from "@solana/spl-token";
import { assert } from "chai";
import { min } from "bn.js";


describe("token-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenContract as Program<TokenContract>;

  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();

  let associatedTokenAccount = undefined;

  it("Mint a token", async () => {
    const key = anchor.AnchorProvider.env().wallet.publicKey;
    const lamports: number = await program.provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      key,
    )

    const mint_tx = new anchor.web3.Transaction().add(
      // use anchor to create an account from the key that we created
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: key,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),
      // fire a transaction to create our mint account that is controoled by our anchor wallet (key)
      createInitializeMintInstruction(
        mintKey.publicKey, 0, key, key
      ),
      // create the ATA account that is assciated with out mint on our anchor wallet (key)
      createAssociatedTokenAccountInstruction(key, associatedTokenAccount, key, mintKey.publicKey)
    )

    // send and create the transaction
    const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, [mintKey]);

    console.log(
      await program.provider.connection.getParsedAccountInfo(mintKey.publicKey)
    );
    console.log("Account: ", res);
    console.log("Mint Key: ", mintKey.publicKey.toString());
    console.log("User: ", key.toString());

    const tx = await program.methods.mintToken().accounts({
      mint: mintKey.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenAccount: associatedTokenAccount,
      payer: key,
    }).rpc();
    console.log("Your transaction signature", tx);
    const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 10);
  });


  it("Transfer token", async () => {
    const myWallet = anchor.AnchorProvider.env().wallet.publicKey;

    const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();

    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    const mint_tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        myWallet, toATA, toWallet.publicKey, mintKey.publicKey,
      )
    );
    const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);

    console.log(res);

    const tx = await program.methods.transferToken().accounts({
      tokenProgram: TOKEN_PROGRAM_ID,
      from: associatedTokenAccount,
      signer: myWallet,
      to: toATA,
    }).rpc();

    console.log("Your transaction signature", tx);
    const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data.parsed.info.tokenAmount.amount;
    assert.equal(minted, 5);
  });
});
