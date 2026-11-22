export const imageFailure = status => Object.assign(new Error('Product image operation unavailable'), { status });

export function createProductImagesRepository(poolProvider) {
  async function get(id, client = poolProvider(), lock = false) {
    try {
      const row = (await client.query(`SELECT product_id,image_public_id FROM products WHERE product_id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
      if (!row) throw imageFailure(404);
      return row;
    } catch (error) {
      if (error.code === '42703') throw imageFailure(503);
      throw error;
    }
  }
  return {
    get,
    async replace(client, id, expected, next) {
      const row = await get(id, client, true);
      if (row.image_public_id !== expected) throw imageFailure(409);
      await client.query('UPDATE products SET image_public_id=$2 WHERE product_id=$1', [id, next]);
    },
  };
}
