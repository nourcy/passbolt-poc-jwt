/**
 * Utility functions related to dates.
 * @namespace dateUtil
 */
exports.dateUtil = {
  /**
   * Gets the expiry timestamp 2 minutes from the current time.
   * @function expiryTimestamp
   * @memberof dateUtil
   * @returns {number} The expiry timestamp.
   */
  expiryTimestamp:  () => {
      return Math.floor((Date.now() + 2 * 60 * 1000) / 1000);
  },
}