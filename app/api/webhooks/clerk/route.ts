import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import sql from '@/lib/db'

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the endpoint
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    })
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url, public_metadata } = evt.data;
    
    const email = email_addresses && email_addresses.length > 0 ? email_addresses[0].email_address : null;
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();
    
    // We default to 'patient', but allow public_metadata to specify 'doctor' if needed
    const role = (public_metadata?.role as string) || 'patient';
    
    // Check if user exists
    const [existingUser] = await sql`SELECT uid FROM users WHERE auth_id = ${id}`;
    
    if (!existingUser) {
        // Insert new user
        await sql`
            INSERT INTO users (auth_id, email, name, profile_image_url, role)
            VALUES (${id}, ${email}, ${fullName}, ${image_url}, ${role})
        `;
    } else {
        // Update existing user
        await sql`
            UPDATE users 
            SET email = ${email}, 
                name = ${fullName}, 
                profile_image_url = ${image_url}
            WHERE auth_id = ${id}
        `;
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    if (id) {
        await sql`DELETE FROM users WHERE auth_id = ${id}`;
    }
  }

  return new Response('', { status: 200 })
}
