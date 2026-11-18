const emailPattern = /^\S+@\S+\.\S+$/;

function initializationError(code, message) {
  return Object.assign(new Error(message), { code });
}

function bootstrapText(value, field, maximum) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw initializationError("DATABASE_INITIALIZATION_CONFIG_INVALID", `${field} 必须是1至${maximum}个字符的非空文本`);
  }
  return value.trim();
}

/** IDs are opaque strings, but a missing or whitespace-only identity cannot be
 * used in an authenticated session. JS trim also catches tabs/Unicode spaces
 * that the default SQL TRIM functions do not consistently remove. */
export function countInvalidDatabaseIdentities(schools, users) {
  const invalid = (value) => typeof value !== "string" || !value.trim();
  return schools.filter((school) => invalid(school.id)).length
    + users.filter((user) => invalid(user.id) || invalid(user.school_id)).length;
}

/** Call only after acquiring the database's initialization lock and reading its
 * current contents. Configuration is an empty-database policy, never a command
 * to reset, repair, or add accounts to an existing school.
 */
export function planDatabaseInitialization(state, config) {
  const { dialect, schoolCount, userCount, orphanUserCount, invalidIdentityCount, administrators } = state;
  if (!["sqlite", "postgresql"].includes(dialect)
    || ![schoolCount, userCount, orphanUserCount, invalidIdentityCount].every((value) => Number.isSafeInteger(value) && value >= 0)
    || !Array.isArray(administrators)) {
    throw initializationError("DATABASE_INITIALIZATION_STATE_INVALID", "无法可靠读取数据库初始化状态，未创建或修改账号");
  }
  if (schoolCount > 0 || userCount > 0 || orphanUserCount > 0 || invalidIdentityCount > 0 || administrators.length > 0) {
    // Disabled administrators stay disabled. This checks the presence of an
    // administrator identity, not that a user has logged in or can log in.
    const hasAdministrator = administrators.some((admin) => typeof admin?.email === "string"
      && emailPattern.test(admin.email) && admin.email.length <= 254
      && typeof admin.passwordHash === "string" && admin.passwordHash.trim().length > 0);
    if (schoolCount === 0 || userCount === 0 || orphanUserCount > 0 || invalidIdentityCount > 0 || !hasAdministrator) {
      throw initializationError("DATABASE_INITIALIZATION_INCOMPLETE", "数据库已有学校或账号，但初始化状态不完整。请先备份并核对管理员与学校归属；不会自动创建学校、提升账号权限或重置密码");
    }
    return Object.freeze({ mode: "existing" });
  }
  if (config.seedDemoData) {
    if (dialect !== "sqlite") {
      throw initializationError("DATABASE_DEMO_UNSUPPORTED", "空PostgreSQL数据库不支持演示数据初始化。请设置 PHYSICS_API_SEED_DEMO=false 并提供首次管理员配置，或使用独立SQLite演示库");
    }
    return Object.freeze({ mode: "demo" });
  }
  const adminEmail = typeof config.bootstrapAdminEmail === "string" ? config.bootstrapAdminEmail.trim().toLowerCase() : "";
  if (!emailPattern.test(adminEmail) || adminEmail.length > 254) {
    throw initializationError("DATABASE_INITIALIZATION_CONFIG_INVALID", "首次建库需要有效的 PHYSICS_BOOTSTRAP_ADMIN_EMAIL，最长254个字符");
  }
  const adminPassword = config.bootstrapAdminPassword;
  if (typeof adminPassword !== "string" || adminPassword.length < 12 || adminPassword.length > 200 || !adminPassword.trim()) {
    throw initializationError("DATABASE_INITIALIZATION_CONFIG_INVALID", "首次建库的 PHYSICS_BOOTSTRAP_ADMIN_PASSWORD 需要12至200个字符，且不能全为空白");
  }
  return Object.freeze({ mode: "bootstrap", adminEmail, adminPassword,
    adminName: bootstrapText(config.bootstrapAdminName, "PHYSICS_BOOTSTRAP_ADMIN_NAME", 120),
    schoolName: bootstrapText(config.bootstrapSchoolName, "PHYSICS_BOOTSTRAP_SCHOOL_NAME", 160) });
}

/** Only this redacted result may be returned by an adapter or used in logs. */
export function initializationResult(plan) {
  if (plan.mode === "existing") return Object.freeze({ mode: "existing", created: false });
  if (plan.mode === "demo") return Object.freeze({ mode: "demo", created: true, schoolId: "school-demo" });
  if (plan.mode === "bootstrap") return Object.freeze({ mode: "bootstrap", created: true, schoolId: "school-primary", adminEmail: plan.adminEmail });
  throw initializationError("DATABASE_INITIALIZATION_STATE_INVALID", "数据库未返回已确认的初始化结果");
}

export function initializationMessage(result) {
  if (result?.mode === "existing" && result.created === false) return "Database: existing accounts and classroom data preserved; initialization settings were not reapplied";
  if (result?.mode === "demo" && result.created === true) return "Database: new SQLite demo data initialized; see API README for demo sign-in instructions";
  if (result?.mode === "bootstrap" && result.created === true) return `Database: initial administrator created (${result.adminEmail})`;
  throw initializationError("DATABASE_INITIALIZATION_STATE_INVALID", "无法确认数据库初始化结果，未宣称管理员创建成功");
}
