This PR integrates MongoDB (Mongoose), adds admin system, and implements message retention.

After merging:
1. Set environment variables: MONGODB_URI, JWT_SECRET (and optionally PORT, MAX_MESSAGES).
2. Run `npm install`.
3. Start with `npm start` or `npm run dev` for development.
4. For first registered user: If there is no admin in the DB, the first registered account will be set as admin automatically.

NOTE: For production, use an external image host and update the upload handler to forward uploads to the host and store returned URLs only.