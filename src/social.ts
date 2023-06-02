import { ArcadeIdentity } from "./ident";
import { NostrPool } from "./pool";
import { EventTemplate, Filter } from "nostr-tools";

const STALE_GRAPH = 1000 * 60 * 60 * 24 * 7 // 1 week
const GRAPH_DEPTH = 3

// define a nip02 tag type
type NIP02Contact = string[];
type PublicKey = string;
type SocialGraphEntry = {
  pubkey: PublicKey,
  degree: number,
  connection: PublicKey, // For degree 1, this is always the user's own pubkey. For degree 2, this is the pubkey of the contact between us and this contactPubkey.
  // meta: {},
  lastUpdated: number, // timestamp is updated when this contact's social graph is updated
  fwf?: number, // (number of) friends who follow (this contact)
}
type SocialGraph = {
  [key in PublicKey]: SocialGraphEntry;
}

/**
 * Ensure the provided ptag is a valid NIP02 contact we can work with.
 * @param ptag string[p, pubkey, relay?, pet name?]
 * @returns 
 */
export function isValidNIP02Contact(ptag: NIP02Contact): ptag is NIP02Contact {
  return Array.isArray(ptag) &&
    ptag.length >= 2 &&
    ptag.length <= 4 &&
    ptag.every(item => typeof item === 'string') &&
    ptag[0] === 'p' &&
    ptag[1].length === 64
}

export class ArcadeSocial {
  public pool: NostrPool;
  private ident: ArcadeIdentity;
  public socialGraph: SocialGraph = {};
  public iteration = 0;
  public paused = false;
  private pausedOnKey: string | null = null;
  private pausedOnDegree = 1;
  constructor(pool: NostrPool, ident: ArcadeIdentity) {
    this.pool = pool;
    this.ident = ident;
    this.start();
  }
  /**
   * Stop social graph generation process and save where we left off.
   */
  pause(): void {
    this.paused = true;
  }
  /**
   * Start or restart graph generation process.
   */
  start(): void {
    this.paused = false;
    // start or restart
    this.extendGraph(this.pausedOnKey || this.ident.pubKey, this.pausedOnDegree);
  }
  /**
   * Provide a public key to extend the social graph by one degree. Hey that rhymes!
   * @param pubkey PublicKey - raw hex public key
   * @param degree the current degree of separation from the user in this iteration
   */
  extendGraph(pubkey: PublicKey, degree = 1): void {
    // check if paused
    if (this.paused) {
      // save where we left off for when we restart.
      this.pausedOnKey = pubkey;
      this.pausedOnDegree = degree;
      return;
    }
    const kind3: EventTemplate[] = [];
    const filter: Filter<number> = { kinds: [3], authors: [pubkey] };
    this.pool.sub([filter], event => kind3.push(event), () => {
      kind3.sort((a, b) => b.created_at - a.created_at)
      try {
        this.buildGraph(pubkey, kind3[0].tags, degree)
      } catch (error) {
        console.log('pubkey had no contacts', error)
        this.iterateGraph()
      }
      return Promise.resolve();
    });
  }
  async buildGraph(pubkey: PublicKey, contacts: string[][], degree: number): Promise<void> {
    // begin building social graph
    // iterate over contacts in most recent kind3
    // and store each pubkey in a flat socialGraph relative to the user.
    for (const contact of contacts) {
      if (
        isValidNIP02Contact(contact) &&
        contact[1] !== this.ident.pubKey // don't store the user's own pubkey
      ) {
        const contactPubkey = contact[1]
        if (Object.prototype.hasOwnProperty.call(this.socialGraph, contactPubkey)) {
          // this pubkey is already in our socialGraph.
          // increase its fwf (friends who follow) count
          // the fwf metric is only useful for the user's own social graph, but that's ok because so are the other metrics (like degree).
          this.socialGraph[contactPubkey].fwf = (this.socialGraph[contactPubkey].fwf || 0) + 1
        } else {
          // this pubkey is not in our socialGraph. Add it.
          this.socialGraph[contactPubkey] = {
            pubkey: contactPubkey,
            degree,
            connection: pubkey, // For degree 1, this is always the user's own pubkey. For degree 2, this is the pubkey of the contact between us and this contactPubkey.
            // meta: {},
            lastUpdated: 0, // timestamp is updated when this contact's social graph is updated
          }
        }
      }
    }

    // we just updated all the contacts for pubkey; update its lastUpdated timestamp
    if (Object.prototype.hasOwnProperty.call(this.socialGraph, pubkey)) {
      this.socialGraph[pubkey].lastUpdated = Date.now()
    }

    // this.analyze() // console log stuff about the graph as it is built.

    this.iterateGraph()

  }
  /**
   * Iterate over the social graph and update each contact's social graph if it is stale
   * Iteration should not move to the next degree until all contacts in the current degree have been updated - breadth first instead of depth first for good UX.
   */
  iterateGraph() {
    const now = Date.now()
    const graphKeys = Object.keys(this.socialGraph)
    if (this.iteration >= graphKeys.length) {
      // we've completed the graph. start over
      this.iteration = 0
    }
    // get contact
    const contact = graphKeys[this.iteration]
    // if the contact's social graph is stale and < GRAPH_DEPTH degree, update it
    if (
      now - this.socialGraph[contact].lastUpdated > STALE_GRAPH && 
      this.socialGraph[contact].degree + 1 <= GRAPH_DEPTH
      ) {
      this.extendGraph(contact, this.socialGraph[contact].degree + 1)
      this.iteration++
    } else {
      // keep iterating
      // once per second to avoid resource hogging 
      this.iteration++
      setTimeout(this.iterateGraph,1000)
    }
  }
  /**
   * show when each contact was last updated
   * currently unused outside of the console
   * @returns an array of pubkeys sorted by lastUpdated
   */
  lastUpdate(){
    return Object.keys(this.socialGraph).sort( (a,b) => this.socialGraph[b].lastUpdated - this.socialGraph[a].lastUpdated ).map( pk => `${(((+new Date()) - this.socialGraph[pk].lastUpdated)/1000/60).toFixed(1) + 'm ago'} - 0x${pk.substring(0,6)} ` )
  }
  /**
   * analyze the social graph as it is built
   * Debug console only.
   */
  // analyze(){
  //   var degrees = {};
  //   Object.keys(this.socialGraph).map(s => degrees[this.socialGraph[s].degree] = degrees[this.socialGraph[s].degree] ? degrees[this.socialGraph[s].degree] + 1 : 1)

  //   console.log('count of each degree', degrees)

  //   // sort top 10 fwf contacts
  //   // return their pubkey and fwf value
  //   const top10 = Object.keys(this.socialGraph)
  //     .map(s => this.socialGraph[s])
  //     .sort((a, b) => b.fwf - a.fwf)
  //     .slice(0, 10)
  //     .map(s => ({ pubkey: s.pubkey, fwf: s.fwf }))
  //   console.log('top 10 fwf contacts', top10)

  // }
  // given a pubkey, return the pubkeys between it and the root or an empty array if none
  // the pubkeys will be in the order of closest to your pubkey to closest to the target pubkey
  traverse(pubkey: string) {
    const path = []
    let current = this.socialGraph[pubkey]
    while (current.degree > 1) {
      path.unshift(current.connection)
      current = this.socialGraph[current.connection]
    }
    return path
  }
}

