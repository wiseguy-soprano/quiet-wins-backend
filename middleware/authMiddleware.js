const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('is_active, sessions_valid_after')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    if (user.sessions_valid_after && decoded.iat * 1000 < new Date(user.sessions_valid_after).getTime()) {
      return res.status(401).json({ error: 'Session has been logged out, please log in again' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

module.exports = authMiddleware;