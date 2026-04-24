export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'english_learning',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  googleTranslate: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY || '',
  },

  imageService: {
    apiKey: process.env.IMAGE_API_KEY || '',
    provider: process.env.IMAGE_API_PROVIDER || 'unsplash',
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  },

  timeouts: {
    translation: parseInt(process.env.TRANSLATION_TIMEOUT || '5000', 10),
    image: parseInt(process.env.IMAGE_TIMEOUT || '5000', 10),
    dbQuery: parseInt(process.env.DB_QUERY_TIMEOUT || '10000', 10),
  },
};

export default config;
