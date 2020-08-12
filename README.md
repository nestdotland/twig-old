<br />
<p align="center">
  <a href="https://nest.land/">
    <img src="https://nest.land/images/nest.land/logo_light.svg" alt="nest.land logo (light version)" width="110">
  </a>

  <h3 align="center">nest.land - twig</h3>

  <p align="center">
    Nest.land's Private Arweave API
 </p>
</p>

## twig

Handles Arweave transactions, PST tipping, and other functions as an API service.

More information about nest.land's PST [here](https://nest.land/pst). The PS DAO dashboard is [here](https://community.xyz/#j8W245BKgr1_k-lB0NjZ0W5m2z6Ibz1vwn7PuoHOBCI/tokens).

## What is nest.land?

Nest.land combines Deno with the [Arweave Blockchain](https://www.arweave.org/). With us, you can publish your Deno modules to the permaweb, where they can never be deleted. This avoids a major pitfall for web-based module imports while allowing the developer to maximize on the potential of Deno's import design!

## Upload Flow

1. `Rust API` receives package details and puts its contents in the `tmp` folder.

2. `Twig` gets pinged by the Rust API to process the package contents in `tmp` and upload to the permaweb.

3. It returns the tx_id and upload details back to RustAPI, while also processing the PST tip if an external Arweave wallet is used.

4. The `Rust API` saves the upload data to database and returns the success status back to the eggs cli(end-user)

## Credits

### Authors

- [t8](https://github.com/t8), Co-Founder, Frontend, & Project management
- [zorbyte](https://github.com/zorbyte), Co-Founder, & Advisor
- [justablob](https://github.com/justablob), Backend

### Core Team

- [divy-work](https://github.com/divy-work)
- [maximousblk](https://github.com/maximousblk)
- [martonlederer](https://github.com/martonlederer)
- [oganexon](https://github.com/oganexon)

### Contributors

- [ebebbington](https://github.com/ebebbington)
- [yg](https://github.com/yg)
- [jletey](https://github.com/jletey)
- [qu4k](https://github.com/Qu4k)

### Special Thanks

- [Cedrik Boudreau](https://github.com/cedriking)
- [Aidan O'Kelly](https://github.com/aidanok)

### Inspirations

- [Deno Third-Party Modules](https://deno.land/x)

## Copyright

nest.land is licensed under the MIT license. Please see the [LICENSE](../LICENSE) file.
