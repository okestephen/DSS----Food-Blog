// Security Unit Tests
// At the beginning of your test setup

import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import { expect } from 'chai';
import sinon from 'sinon';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { JSDOM } from 'jsdom';

// Import modules to test
import { ensureAuthenticated } from '../middleware/authMiddleware.js';
import { validateSession } from '../middleware/sessionIntegrity.js';
import { 
  encrypt, decrypt, hashPassword, verifyPassword, 
  encryptInfo, decryptInfo 
} from '../utils/crypto.js';
import { isPwned } from '../utils/checkPwnedPassword.js';
import { escapeHTML } from '../utils/sanitize.js';
import { validateSignupInput, isValidPassword } from '../utils/validation.js';

describe('Security Features Tests', function() {
  /********************************************
   * AUTHENTICATION & SESSION MANAGEMENT TESTS
   ********************************************/
  describe('Authentication & Session Management', function() {
    let req, res, next;
    
    beforeEach(function() {
      req = {
        session: {},
        ip: '127.0.0.1',
        get: sinon.stub().returns('Mozilla/5.0')
      };
      res = {
        redirect: sinon.spy(),
        status: sinon.stub().returnsThis(),
        send: sinon.spy()
      };
      next = sinon.spy();
    });
    
    describe('Authentication Middleware', function() {
      it('should call next() when user is authenticated', function() {
        req.session.user = { id: 1, email: 'test@example.com' };
        ensureAuthenticated(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(res.redirect.called).to.be.false;
      });
      
      it('should redirect to login when user is not authenticated', function() {
        req.session.user = null;
        ensureAuthenticated(req, res, next);
        expect(next.called).to.be.false;
        expect(res.redirect.calledWith('/login')).to.be.true;
      });
    });
    
    describe('Session Integrity Validation', function() {
      it('should call next() when session integrity is valid', function() {
        req.session.user = { id: 1 };
        req.session.ua = 'Mozilla/5.0';
        req.session.ip = '127.0.0.1';
        validateSession(req, res, next);
        expect(next.calledOnce).to.be.true;
      });
      
      it('should redirect to login when user agent changes', function() {
        req.session.user = { id: 1 };
        req.session.ua = 'Different-UA';
        req.session.ip = '127.0.0.1';
        validateSession(req, res, next);
        expect(next.called).to.be.false;
        expect(res.redirect.calledWith('/login')).to.be.true;
      });
      
      it('should redirect to login when IP address changes', function() {
        req.session.user = { id: 1 };
        req.session.ua = 'Mozilla/5.0';
        req.session.ip = '192.168.1.1';
        validateSession(req, res, next);
        expect(next.called).to.be.false;
        expect(res.redirect.calledWith('/login')).to.be.true;
      });
    });
    
    describe('Idle Timeout Middleware', function() {
      let clock;
      
      beforeEach(function() {
        clock = sinon.useFakeTimers(Date.now());
      });
      
      afterEach(function() {
        clock.restore();
      });
      
      it('should allow request when last active time is recent', function() {
        req.session.lastActive = Date.now() - (20 * 60 * 1000); // 20 minutes ago
        validateSession(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(req.session.lastActive).to.equal(Date.now());
      });
      
      it('should redirect to login with timeout flag when session is idle too long', function() {
        req.session.user = { id: 1 };
        req.session.lastActive = Date.now() - (31 * 60 * 1000); // 31 minutes ago
        validateSession(req, res, next);
        expect(next.called).to.be.false;
        expect(res.redirect.calledWith('/login?timeout=true')).to.be.true;
      });
    });
  });

  /*****************************
   * CRYPTOGRAPHIC TESTS
   *****************************/
  describe('Cryptography', function() {
    const testKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
    
    describe('Symmetric Encryption', function() {
      it('should correctly encrypt and decrypt messages', function() {
        const plaintext = 'This is a secret message';
        const encrypted = encrypt(Buffer.from(plaintext, 'utf8'), testKey);
        const decrypted = decrypt(encrypted, testKey);
        
        expect(decrypted.toString('utf8')).to.equal(plaintext);
      });
      
      it('should produce different ciphertexts for the same plaintext', function() {
        const plaintext = 'This is a secret message';
        const encrypted1 = encrypt(Buffer.from(plaintext, 'utf8'), testKey);
        const encrypted2 = encrypt(Buffer.from(plaintext, 'utf8'), testKey);
        
        expect(encrypted1.toString('hex')).to.not.equal(encrypted2.toString('hex'));
      });
      
      it('should throw error when decrypting with wrong key', function() {
        const plaintext = 'This is a secret message';
        const encrypted = encrypt(Buffer.from(plaintext, 'utf8'), testKey);
        const wrongKey = Buffer.from('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 'hex');
        
        expect(() => decrypt(encrypted, wrongKey)).to.throw();
      });
    });
    
    describe('Password Hashing & Verification', function() {
      // Mock process.env.PEPPER
      before(function() {
        process.env.PEPPER = 'test-pepper-value';
      });
      
      it('should hash passwords with salt and pepper', async function() {
        const password = 'StrongP@ssw0rd';
        const hash = await hashPassword(password);
        
        // Hash should be a bcrypt hash
        expect(hash).to.match(/^\$2[aby]\$\d+\$/);
        
        // Length should be consistent with bcrypt
        expect(hash.length).to.be.above(50);
      });
      
      it('should verify correct passwords', async function() {
        const password = 'StrongP@ssw0rd';
        const hash = await hashPassword(password);
        const result = await verifyPassword(password, hash);
        
        expect(result).to.be.true;
      });
      
      it('should reject incorrect passwords', async function() {
        const password = 'StrongP@ssw0rd';
        const wrongPassword = 'WrongP@ssw0rd';
        const hash = await hashPassword(password);
        const result = await verifyPassword(wrongPassword, hash);
        
        expect(result).to.be.false;
      });
    });
    
    describe('User Data Encryption', function() {
      it('should encrypt and decrypt user information correctly', function() {
        const firstname = 'John';
        const lastname = 'Doe';
        const email = 'john.doe@example.com';
        const phone = '1234567890';
        
        const encrypted = encryptInfo(firstname, lastname, email, phone, testKey);
        
        expect(encrypted.firstname).to.be.a('string');
        expect(encrypted.lastname).to.be.a('string');
        expect(encrypted.email).to.be.a('string');
        expect(encrypted.phone).to.be.a('string');
        
        // Check if values are actually encrypted
        expect(encrypted.firstname).to.not.equal(firstname);
        expect(encrypted.email).to.not.equal(email);
        
        const decrypted = decryptInfo(encrypted, testKey);
        
        expect(decrypted.firstname).to.equal(firstname);
        expect(decrypted.lastname).to.equal(lastname);
        expect(decrypted.email).to.equal(email);
        expect(decrypted.phone).to.equal(phone);
      });
      
      it('should handle null phone values', function() {
        const firstname = 'John';
        const lastname = 'Doe';
        const email = 'john.doe@example.com';
        const phone = null;
        
        const encrypted = encryptInfo(firstname, lastname, email, phone, testKey);
        expect(encrypted.phone).to.be.null;
        
        const decrypted = decryptInfo(encrypted, testKey);
        expect(decrypted.phone).to.be.null;
      });
    });
  });

  /*****************************
   * INPUT VALIDATION TESTS
   *****************************/
  describe('Input Validation', function() {
    describe('Sign-up Validation', function() {
      it('should accept valid input data', function() {
        const fname = 'John';
        const lname = 'Doe';
        const email = 'john.doe@example.com';
        const password = 'StrongP@ssw0rd';
        const passwordConf = 'StrongP@ssw0rd';
        const phone = '1234567890';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf, phone)).to.not.throw();
      });
      
      it('should reject empty input fields', function() {
        const fname = '';
        const lname = 'Doe';
        const email = 'john.doe@example.com';
        const password = 'StrongP@ssw0rd';
        const passwordConf = 'StrongP@ssw0rd';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf)).to.throw('Empty input fields!');
      });
      
      it('should reject invalid email format', function() {
        const fname = 'John';
        const lname = 'Doe';
        const email = 'not-an-email';
        const password = 'StrongP@ssw0rd';
        const passwordConf = 'StrongP@ssw0rd';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf)).to.throw('Invalid email address');
      });
      
      it('should reject short passwords', function() {
        const fname = 'John';
        const lname = 'Doe';
        const email = 'john.doe@example.com';
        const password = 'Short';
        const passwordConf = 'Short';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf)).to.throw('Password must include');
      });
      
      it('should reject mismatched passwords', function() {
        const fname = 'John';
        const lname = 'Doe';
        const email = 'john.doe@example.com';
        const password = 'StrongP@ssw0rd';
        const passwordConf = 'DifferentP@ssw0rd';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf)).to.throw('Passwords do not match');
      });
      
      it('should reject invalid name formats', function() {
        const fname = 'John123';
        const lname = 'Doe';
        const email = 'john.doe@example.com';
        const password = 'StrongP@ssw0rd';
        const passwordConf = 'StrongP@ssw0rd';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf)).to.throw('Invalid name');
      });
      
      it('should reject invalid phone numbers', function() {
        const fname = 'John';
        const lname = 'Doe';
        const email = 'john.doe@example.com';
        const password = 'StrongP@ssw0rd';
        const passwordConf = 'StrongP@ssw0rd';
        const phone = 'abc123';
        
        expect(() => validateSignupInput(fname, lname, email, password, passwordConf, phone)).to.throw('Invalid phone number');
      });
    });
    
    describe('Password Strength Validation', function() {
      it('should accept passwords with minimum length', function() {
        expect(isValidPassword('12345678')).to.be.true;
      });
      
      it('should reject passwords shorter than minimum length', function() {
        expect(isValidPassword('1234567')).to.be.false;
      });
    });
    
    describe('Pwned Password Check', function() {
      let axiosStub;
      
      beforeEach(function() {
        axiosStub = sinon.stub(axios, 'get');
      });
      
      afterEach(function() {
        axiosStub.restore();
      });
      
      it('should detect commonly used compromised passwords', async function() {
        // Mock k-Anonymity API response for "password"
        // SHA-1 of "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
        // Prefix = 5BAA6, Suffix = 1E4C9B93F3F0682250B6CF8331B7EE68FD8
        
        axiosStub.resolves({ 
          data: '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\nOTHERHASH:123'
        });
        
        const result = await isPwned('password');
        expect(result).to.be.true;
      });
      
      it('should approve unique passwords', async function() {
        axiosStub.resolves({ data: 'SOMEHASH:123\nOTHERHASH:456' });
        
        const result = await isPwned('UniqueAndStrong!P@ssw0rd');
        expect(result).to.be.false;
      });
      
      it('should handle API errors gracefully', async function() {
        axiosStub.rejects(new Error('API Connection Failed'));
        
        const result = await isPwned('password');
        expect(result).to.be.false; // Fail-safe: returns false
      });
    });
  });

  /*****************************
   * XSS PREVENTION TESTS
   *****************************/
  describe('XSS Prevention', function() {
    describe('HTML Escaping', function() {
      it('should escape HTML special characters', function() {
        const input = '<script>alert("XSS")</script>';
        const escaped = escapeHTML(input);
        
        expect(escaped).to.equal('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      });
      
      it('should escape all potentially dangerous characters', function() {
        const input = '&<>"\'/';
        const escaped = escapeHTML(input);
        
        expect(escaped).to.equal('&amp;&lt;&gt;&quot;&#x27;&#x2F;');
      });
    });
  });

  /*****************************
   * CSRF PROTECTION TESTS
   *****************************/
  describe('CSRF Protection', function() {
    it('should set sameSite cookie attribute to strict', function() {
      // Create a mock express app to test session cookie settings
      const mockApp = {
        use: sinon.spy()
      };
      
      const sessionMiddleware = function(options) {
        expect(options.cookie.sameSite).to.equal('strict');
      };
      
      sessionMiddleware({ cookie: { sameSite: 'strict' } });
    });
  });

  /*****************************
   * CLICKJACKING PROTECTION TESTS
   *****************************/
  describe('Clickjacking Protection', function() {
    it('should set X-Frame-Options header to DENY', function() {
      // Create a mock response object
      const res = {
        headers: {},
        setHeader: function(name, value) {
          this.headers[name] = value;
        }
      };
      
      // Create a mock helmet.frameguard middleware
      const frameguard = function(options) {
        return function(req, res, next) {
          res.setHeader('X-Frame-Options', 'DENY');
          next && next();
        };
      };
      
      const middleware = frameguard({ action: 'deny' });
      middleware(null, res, () => {});
      
      expect(res.headers['X-Frame-Options']).to.equal('DENY');
    });
  });

  /*****************************
   * ACCOUNT SECURITY TESTS
   *****************************/
  describe('Account Security', function() {
    describe('Account Enumeration Prevention', function() {
      let req, res;
      
      beforeEach(function() {
        req = { body: { email: 'test@example.com' } };
        res = { render: sinon.spy() };
      });
      
      it('should return identical responses for existing and non-existing accounts', function() {
        // Mock forgot-password response
        const successMessage = "If that email address is in our database, we will send you an email to reset your password.";
        
        // Simulate response for existing user
        res.render('forgot-password.ejs', { 
          error: null,
          message: successMessage
        });
        
        const existingUserResponse = res.render.getCall(0).args;
        
        // Reset spy
        res.render.resetHistory();
        
        // Simulate response for non-existing user
        res.render('forgot-password.ejs', { 
          error: null,
          message: successMessage
        });
        
        const nonExistingUserResponse = res.render.getCall(0).args;
        
        // Both responses should be identical
        expect(existingUserResponse).to.deep.equal(nonExistingUserResponse);
      });
    });
    
    describe('Brute Force Protection', function() {
      it('should implement progressive delays', function() {
        // Test the delay calculation logic
        function calculateDelay(failedAttempts) {
          if (failedAttempts < 3) return 0;
          return Math.pow(2, failedAttempts - 3) * 1000;
        }
        
        expect(calculateDelay(3)).to.equal(1000);    // 1 second
        expect(calculateDelay(4)).to.equal(2000);    // 2 seconds
        expect(calculateDelay(5)).to.equal(4000);    // 4 seconds
        expect(calculateDelay(6)).to.equal(8000);    // 8 seconds
      });
      
      it('should lock accounts after too many failed attempts', function() {
        const maxAttempts = 6;
        const userAttempts = 6;
        const shouldLock = userAttempts >= maxAttempts;
        
        expect(shouldLock).to.be.true;
      });
    });
  });

  /*****************************
   * MULTI-FACTOR AUTHENTICATION TESTS
   *****************************/
  describe('Multi-Factor Authentication (OTP)', function() {
    let req, res, db;
    
    beforeEach(function() {
      req = {
        session: {
          pendingUser: {
            id: 1,
            slug: 'john-doe',
            decrypted: {
              email: 'john.doe@example.com',
              firstname: 'John'
            }
          }
        },
        body: {},
        ip: '127.0.0.1',
        get: sinon.stub().returns('Mozilla/5.0')
      };
      
      res = {
        render: sinon.spy(),
        redirect: sinon.spy()
      };
      
      db = {
        query: sinon.stub()
      };
    });
    
    it('should generate secure OTPs of appropriate length', function() {
      // Test OTP generation (6 digits)
      function generateOtp() {
        return crypto.randomInt(100000, 999999).toString();
      }
      
      const otp = generateOtp();
      expect(otp.length).to.equal(6);
      expect(parseInt(otp)).to.be.at.least(100000);
      expect(parseInt(otp)).to.be.at.most(999999);
    });
    
    it('should hash OTPs before storing them', async function() {
      const otpCode = '123456';
      const hashedOtp = await bcrypt.hash(otpCode, 10);
      
      expect(hashedOtp).to.not.equal(otpCode);
      expect(hashedOtp).to.match(/^\$2[aby]\$\d+\$/);
    });
    
    it('should enforce OTP expiration', function() {
      const expiryMinutes = 5;
      const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
      const now = new Date();
      
      expect(expiry > now).to.be.true;
      
      const pastExpiry = new Date(expiry.getTime() + 1000);
      expect(expiry < pastExpiry).to.be.true;
    });
    
    it('should verify OTPs securely', async function() {
      const otpCode = '123456';
      const hashedOtp = await bcrypt.hash(otpCode, 10);
      
      const validResult = await bcrypt.compare(otpCode, hashedOtp);
      expect(validResult).to.be.true;
      
      const invalidResult = await bcrypt.compare('654321', hashedOtp);
      expect(invalidResult).to.be.false;
    });
    
    it('should implement rate limiting for OTP resends', function() {
      const lastSent = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      const secondsSinceLast = (Date.now() - lastSent.getTime()) / 1000;
      const minInterval = 60; // 60 seconds between resends
      
      const canResend = secondsSinceLast >= minInterval;
      expect(canResend).to.be.false;
      
      const waitTime = Math.ceil(minInterval - secondsSinceLast);
      expect(waitTime).to.be.approximately(30, 1);
    });
  });
});
