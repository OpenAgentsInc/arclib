/* eslint-disable @typescript-eslint/no-unused-vars */

import { NostrPool } from '.';

class Contact {
  pubkey: string;
  secret: boolean;
  legacy: boolean;
}

type PrivList = Array<[string, Record<string, string|number|null>]>;

export class ContactManager {
  private pool: NostrPool;
  public contacts: Map<string, Contact>
  lastRead: number;
  hasRead: boolean = false;
  
  //  private store: SqliteStore;

  constructor(pool: NostrPool) {
    this.pool = pool 
    this.contacts = new Map()
  }

  async add(contact: Contact): Promise<void> {
    const has = this.contacts.get(contact.pubkey)
    if (has && has.secret == contact.secret && has.legacy == contact.legacy)
      return 
      
    this.contacts[contact.pubkey] = contact
    await this.write()
  }

  async remove(pubkey: string) {
    const has = this.contacts.get(pubkey)
    if (!has)
      return
      
    this.contacts.delete(pubkey)
    await this.write()
  }
  
  async write() {
    const secretContacts = Array.from(this.contacts.values()).filter(e=>e.secret).map(e=>[e.pubkey, {legacy: e.legacy, secret: e.secret}])
    const publicContacts = Array.from(this.contacts.values()).filter(e=>!e.secret).map(e=>["p", e.pubkey])
    await this.pool.send({
      content: "",
      tags: publicContacts,
      kind: 3,
    })
    await this.pool.send({
      content: await this.pool.ident.selfEncrypt(JSON.stringify(secretContacts)),
      tags: [], 
      kind: 20003,
    })
  }

  async list(): Promise<Contact[]> {
    if (!this.hasRead) {
      await this.read()
    }
    return Array.from(this.contacts.values())
  }

  async read(): Promise<void> {
      this.contacts = new Map((await this.readContacts()).map(e=>[e.pubkey, e]))
      this.hasRead = true
  }

  async readContacts(): Promise<Contact[]> {
    const pubR = await this.pool.list([{
      authors: [this.pool.ident.pubKey],
      kinds: [3],
    }])

    const privR = await this.pool.list([{
      authors: [this.pool.ident.pubKey],
      kinds: [20003],
      limit: 1
    }])

    const res = []
    if (pubR && pubR[0] && pubR[0].tags) {
      res.push(...pubR[0].tags.filter(tag=>tag[0]=="p").map(tag=>{return {pubkey: tag[1], secret: false, legacy: false}}))
    }

    if (privR && privR[0] && privR[0].content) {
      try {
        const privC: PrivList = JSON.parse(await this.pool.ident.selfDecrypt(privR[0].content))
        res.push(...privC.map(ent=>{return {pubkey: ent[0], secret: ent[1].secret, legacy: ent[1].legacy}}))
      } catch (e) {
        console.log("can't load private contacts", e)
      }
    }
    return res
  }
}
