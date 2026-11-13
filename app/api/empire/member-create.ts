export type NewMember={name:string;dateOfBirth:string;address:string;phone:string;email:string;membershipType:string;gender?:string};
export type CredentialMaterial={salt:string;hash:string;encryptedCode:string;fingerprint:string};
export async function createMemberAndCredential(db:D1Database,member:NewMember,credential:CredentialMaterial){
 const now=new Date().toISOString();
 const [insert]=await db.batch([
  db.prepare("INSERT INTO empire_members (name,date_of_birth,address,phone,email,membership_type,gender,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(member.name,member.dateOfBirth,member.address,member.phone,member.email,member.membershipType,member.gender||null,now),
  db.prepare("INSERT INTO empire_member_credentials (member_id,salt,code_hash,encrypted_code,code_fingerprint,created_at,updated_at) VALUES (last_insert_rowid(),?,?,?,?,?,?)").bind(credential.salt,credential.hash,credential.encryptedCode,credential.fingerprint,now,now)
 ]);
 return Number(insert.meta.last_row_id);
}
