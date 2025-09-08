/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('users', table => {
      table.increments('id').primary();
      table.string('usuario').notNullable().unique();
      table.string('password').notNullable();
      table.string('nombre');
      table.string('apellido');
      table.string('dni');
      table.string('ruc');
      table.string('empresa');
      table.string('celular');
      table.string('correo');
      table.timestamps(true, true);
    })
    .createTable('fincas', table => {
      table.string('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('propietario');
      table.string('dni_ruc');
      table.string('nombre_finca').notNullable();
      table.string('pais');
      table.string('ciudad');
      table.integer('altura');
      table.decimal('superficie');
      table.json('coordenadas');
      table.timestamps(true, true);
      table.unique(['user_id', 'nombre_finca']);
    })
    .createTable('lotes', table => {
      table.string('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE'); // Para cosechas
      table.string('tipo').notNullable();
      table.string('parent_id').references('id').inTable('lotes').onDelete('CASCADE');
      table.json('data').notNullable();
      table.timestamps(true, true);
    })
    .createTable('perfiles_cacao', table => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('nombre').notNullable();
      table.json('perfil_data').notNullable();
      table.timestamps(true, true);
      table.unique(['user_id', 'nombre']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('perfiles_cacao')
    .dropTableIfExists('lotes')
    .dropTableIfExists('fincas')
    .dropTableIfExists('users');
};
