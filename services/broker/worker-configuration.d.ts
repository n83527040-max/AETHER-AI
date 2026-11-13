// Workers types intentionally omit a few DOM WebCrypto parameter aliases that
// this dependency-free JWT code uses. Declaring them here keeps the shared
// sources identical for Node tests and the Worker bundle.
type AlgorithmIdentifier = string | { name: string };

interface RsaPssParams {
  name: string;
  saltLength: number;
}

interface EcdsaParams {
  name: string;
  hash: AlgorithmIdentifier;
}

interface HmacImportParams {
  name: string;
  hash: AlgorithmIdentifier;
  length?: number;
}
