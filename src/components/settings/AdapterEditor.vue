<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    @close="handleClose"
    :width="isMobile ? '100%' : '760px'"
    :close-on-click-modal="false"
    class="form-dialog adapter-editor-dialog v4-editor-dialog"
    destroy-on-close
    append-to-body
  >
    <div class="dialog-scroll-body" ref="dialogBodyRef">
      <!-- 常用服务预设 (可选) -->
      <div class="field-box" id="fldPreset">
        <label class="field-lbl">
          常用服务预设 <span class="tag-badge gray">可选</span>
        </label>
        <div class="pd-container" ref="pdContainerRef">
          <button type="button" class="pd-trigger" :class="{ open: pdOpen }" @click="togglePd">
            <span class="ava">
              <img
                v-if="currentAvatarUrl && !isCurrentAvatarFailed"
                :src="currentAvatarUrl"
                :alt="selectedPreset ? selectedPreset.name : props.type"
                @error="handleCurrentAvatarError"
              />
              <span v-else>{{ currentAvatarLetter }}</span>
            </span>
            <span class="txt" :class="{ ph: !selectedPreset && props.mode !== 'edit' }">
              {{ selectedPreset ? selectedPreset.name : (props.mode === 'edit' ? (props.adapter?.name || props.type) : '从内置服务快速预填（不选也能直接填 URL）') }}
            </span>
            <span class="caret">▾</span>
          </button>
          <div v-show="pdOpen" class="pd-panel">
            <div class="srch">
              <input
                ref="pdSearchInputRef"
                v-model="pdSearchQuery"
                placeholder="搜索服务名 / 中文别名 / 域名..."
                autocomplete="off"
              />
            </div>
            <div class="pd-list">
              <template v-if="filteredPresetGroups.length > 0">
                <div v-for="group in filteredPresetGroups" :key="group.name">
                  <div class="pd-group-title">{{ group.name }}</div>
                  <div
                    v-for="p in group.items"
                    :key="p.id"
                    class="pd-item"
                    @click="applyPreset(p)"
                  >
                    <span class="ava">
                      <img
                        v-if="!isPresetAvatarFailed(p)"
                        :src="p.avatar"
                        :alt="`${p.name} avatar`"
                        @error="handlePresetAvatarError(p)"
                      />
                      <span v-else>{{ p.letter }}</span>
                    </span>
                    <div class="mid">
                      <div class="nm">
                        {{ p.name }}
                        <span class="tag-badge" :style="{ background: getProtoColor(p.proto) + '1a', color: getProtoColor(p.proto) }">
                          {{ getProtoShort(p.proto) }}
                        </span>
                      </div>
                      <div class="url mono">{{ p.url }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="empty-hint">没有匹配的预设，直接在下方填 URL 即可</div>
            </div>
          </div>
        </div>
        <div class="hint-txt">
          从内置常用服务一键预填 Base URL、协议与默认模型，填完可根据需要自由修改。
        </div>
      </div>

      <!-- 显示名 (可选) -->
      <div class="field-box">
        <label class="field-lbl">
          显示名 <span class="tag-badge gray">可选</span>
        </label>
        <div class="input-wrap">
          <input v-model="formData.name" placeholder="留空则自动生成，例如 deepseek-1" autocomplete="off" />
        </div>
      </div>

      <!-- Base URL -->
      <div class="field-box" id="fldUrl">
        <label class="field-lbl">
          Base URL <span class="req">*</span>
          <span class="tag-badge" :class="isUrlLocked ? 'blue' : 'gray'">
            {{ isUrlLocked ? '自动生成 · 只读' : '可手填' }}
          </span>
        </label>
        <div class="input-wrap" :class="{ locked: isUrlLocked, err: urlHasError }">
          <input
            v-model="formData.url"
            class="mono"
            :readonly="isUrlLocked"
            placeholder="https://api.deepseek.com/v1"
            autocomplete="off"
            @input="onUrlChange"
          />
        </div>
        <div class="hint-txt" :class="{ warn: urlHasWarning }">
          {{ urlHintText }}
        </div>
      </div>

      <!-- 连接方式与协议 (并列行) -->
      <div class="row-two">
        <div class="field-box">
          <label class="field-lbl">
            连接方式 <span class="req">*</span>
          </label>
          <select v-model="formData.conn" class="native-select" @change="onConnChange">
            <option
              v-for="c in CONN_OPTIONS"
              :key="c.value"
              :value="c.value"
              :disabled="isConnDisabled(c.value)"
              :title="isConnDisabled(c.value) ? '该连接方式专用于 Gemini 协议' : ''"
            >
              {{ c.label }}
            </option>
          </select>
        </div>

        <div class="field-box">
          <label class="field-lbl">
            协议 <span class="req">*</span>
            <span v-if="formData.proto === DEFAULT_PROTO" class="tag-badge blue">默认值</span>
          </label>
          <select v-model="formData.proto" class="native-select" @change="onProtoChange">
            <option
              v-for="p in PROTO_OPTIONS"
              :key="p.value"
              :value="p.value"
              :disabled="isProtoDisabled(p.value)"
              :title="isProtoDisabled(p.value) ? 'Vertex / OAuth 连接方式需配合 Gemini 协议' : ''"
            >
              {{ p.label }}
            </option>
          </select>
        </div>
      </div>

      <div class="proto-info-row">
        <div class="hint-txt proto-desc">{{ currentProtoDesc }}</div>
        <div class="proto-caps">
          <span v-for="cap in currentProtoCaps" :key="cap" class="tag-badge gray">{{ cap }}</span>
        </div>
      </div>

      <!-- 动态凭据区 -->
      <div class="field-box cred-field-box">
        <label class="field-lbl">
          凭据 <span class="req">*</span>
          <span class="tag-badge gray">{{ currentCredKindLabel }}</span>
        </label>

        <!-- 凭据 1: API Key -->
        <div v-if="formData.conn === 'api-key'" class="cred-card cred-api">
          <div class="input-wrap" :class="{ err: apiKeyError }">
            <input
              v-model="formData.key"
              :type="showApiKeyText ? 'text' : 'password'"
              placeholder="sk-..."
              autocomplete="off"
            />
            <span class="addon-btn" @click="showApiKeyText = !showApiKeyText">
              {{ showApiKeyText ? '隐藏' : '显示' }}
            </span>
          </div>
          <div class="hint-txt">仅用于本实例鉴权，不写入原型之外的任何地方</div>
        </div>

        <!-- 凭据 2: Vertex Express -->
        <div v-else-if="formData.conn === 'vertex-express'" class="cred-card cred-vx">
          <div class="row-two">
            <div>
              <div class="sub-lbl">project_id <span class="req">*</span></div>
              <div class="input-wrap">
                <input v-model="formData.vx_project" placeholder="my-gcp-project" autocomplete="off" />
              </div>
            </div>
            <div>
              <div class="sub-lbl">API Key（Vertex AI） <span class="req">*</span></div>
              <div class="input-wrap" :class="{ err: vxKeyError }">
                <input
                  v-model="formData.vx_key"
                  :type="showVxKeyText ? 'text' : 'password'"
                  placeholder="AIza..."
                  autocomplete="off"
                />
                <span class="addon-btn" @click="showVxKeyText = !showVxKeyText">
                  {{ showVxKeyText ? '隐藏' : '显示' }}
                </span>
              </div>
            </div>
          </div>
          <div class="hint-txt">
            Express 模式 = 用 API Key 直连 Vertex（支持自定义 Base URL 反代，默认端点为 <b>https://aiplatform.googleapis.com</b>）；后端对应 <code>block_express: false</code>。
          </div>
        </div>

        <!-- 凭据 3: Vertex ADC -->
        <div v-else-if="formData.conn === 'vertex-adc'" class="cred-card cred-adc">
          <div class="row-two">
            <div>
              <div class="sub-lbl">project_id <span class="req">*</span></div>
              <div class="input-wrap">
                <input v-model="formData.adc_project" placeholder="my-gcp-project" autocomplete="off" />
              </div>
            </div>
            <div>
              <div class="sub-lbl">凭据来源</div>
              <select v-model="formData.adc_src" class="native-select">
                <option value="adc">应用默认凭据 ADC（无需填 Key）</option>
                <option value="json">粘贴 service account JSON</option>
              </select>
            </div>
          </div>

          <div v-if="formData.adc_src === 'adc'" class="adc-env-box">
            <div class="hint-txt">
              ADC 由<b>运行环境</b>提供，表单里不需要粘贴任何密钥：<br />
              · 环境变量 <code>GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json</code><br />
              · 或本机执行 <code>gcloud auth application-default login</code>
            </div>
          </div>

          <div v-else class="adc-json-box">
            <div class="sub-lbl" style="margin-top: 10px;">凭据（service account JSON） <span class="req">*</span></div>
            <textarea
              v-model="formData.adc_json"
              class="ta-json"
              :class="{ err: !adcJsonParsed.valid && formData.adc_json.trim().length > 0 }"
              placeholder='粘贴 service account JSON，例如 {"type":"service_account","project_id":"...","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----"}'
              @input="onAdcJsonInput"
            ></textarea>
            <div class="sa-summary" :class="adcJsonParsed.valid ? 'ok' : formData.adc_json.trim() ? 'bad' : ''">
              <template v-if="!formData.adc_json.trim()">
                粘贴后即时解析并回显：项目 ID / 服务账号邮箱 / 是否含 private_key
              </template>
              <template v-else-if="!adcJsonParsed.valid">
                <b>粘贴完整的 service account JSON</b>（至少包含 project_id / client_email / private_key 之一）
              </template>
              <template v-else>
                <div><span class="k">项目 ID：</span>{{ adcJsonParsed.project_id || '（JSON 中未提供）' }}</div>
                <div><span class="k">服务账号邮箱：</span>{{ adcJsonParsed.client_email || '（JSON 中未提供）' }}</div>
                <div><span class="k">是否含 private_key：</span><b>{{ adcJsonParsed.hasKey ? '是' : '否' }}</b></div>
              </template>
            </div>
          </div>
          <div class="hint-txt">
            ADC 模式下后端走 <code>block_express: true</code>，只需要 project_id（同样支持自定义 Base URL 反代）。
          </div>
        </div>

        <!-- 独立模型列表拉取配置（Vertex 专用：配置独立 AI Studio 端点与 Key 绕过权限限制拉取模型） -->
        <div
          v-if="formData.conn === 'vertex-express' || formData.conn === 'vertex-adc'"
          class="cred-card cred-studio-models"
        >
          <div
            class="studio-models-head"
            @click="showModelsConfig = !showModelsConfig"
          >
            <div class="head-left">
              <span class="toggle-arrow">{{ showModelsConfig ? '▼' : '▶' }}</span>
              <span class="sub-lbl" style="margin: 0; cursor: pointer;">
                独立模型获取配置（Google AI Studio 端口/端点与 Key）
              </span>
              <span class="tag-badge" :class="hasCustomModelsConfig ? 'blue' : 'gray'">
                {{ hasCustomModelsConfig ? '已配置' : '可选' }}
              </span>
            </div>
            <div class="head-right">
              <span class="hint-txt" style="margin: 0; cursor: pointer;">
                {{ showModelsConfig ? '收起配置' : '展开配置' }}
              </span>
            </div>
          </div>

          <div v-show="showModelsConfig" class="studio-models-body">
            <div class="row-two" style="margin-top: 10px;">
              <div>
                <div class="sub-lbl">模型拉取 Base URL / 端口</div>
                <div class="input-wrap">
                  <input
                    v-model="formData.models_base_url"
                    placeholder="https://generativelanguage.googleapis.com"
                    autocomplete="off"
                  />
                </div>
                <div class="hint-txt">
                  留空默认为 AI Studio 官方端点，支持单独配置反代或指定本地端口
                </div>
              </div>
              <div>
                <div class="sub-lbl">模型拉取 API Key</div>
                <div class="input-wrap">
                  <input
                    v-model="formData.models_api_key"
                    :type="showModelsKeyText ? 'text' : 'password'"
                    placeholder="AIzaSy... (Google AI Studio Key)"
                    autocomplete="off"
                  />
                  <span class="addon-btn" @click="showModelsKeyText = !showModelsKeyText">
                    {{ showModelsKeyText ? '隐藏' : '显示' }}
                  </span>
                </div>
                <div class="hint-txt">
                  填入 Google AI Studio Key 可绕过 Google Cloud 权限限制获取完整模型列表
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 凭据 4: OAuth 授权 -->
        <div v-else-if="formData.conn === 'oauth'" class="cred-card cred-oauth">
          <div class="oauth-card" :class="oauthCardClass">
            <!-- 未授权 (Idle) -->
            <div v-if="oauthState === 'idle'" class="oa-state">
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <button type="button" class="btn primary oauth-btn" @click="startOAuth" :disabled="fetchingOAuthUrl">
                  <span v-if="fetchingOAuthUrl" class="spin"></span>
                  连接 Google 账号
                </button>
                <a
                  v-if="currentOAuthUrl"
                  :href="currentOAuthUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="oa-link"
                >
                  在新标签页打开 ↗
                </a>
              </div>
              <div class="hint-txt">将打开 Google 官方授权页，授权后可随时撤销</div>
            </div>

            <!-- 授权中 (Pending) -->
            <div v-else-if="oauthState === 'pending'" class="oa-state oa-pending-row">
              <button type="button" class="btn primary sm" @click="openOAuthPage" :disabled="fetchingOAuthUrl">
                <span v-if="fetchingOAuthUrl" class="spin"></span>
                打开授权页
              </button>
              <button v-if="currentOAuthUrl" type="button" class="btn sm" @click="copyOAuthCode">
                复制授权链接
              </button>
              <a
                v-if="currentOAuthUrl"
                :href="currentOAuthUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="oa-link"
              >
                直接打开链接 ↗
              </a>
              <span class="spacer"></span>
              <span class="spin"></span>
              <span class="hint-txt" style="margin:0;">等待授权回填中…</span>
            </div>

            <!-- 已授权 (Done) -->
            <div v-else-if="oauthState === 'done'" class="oa-state oa-done-row">
              <span class="dot g"></span>
              <b>{{ oauthAccountEmail }}</b>
              <span class="tag-badge gray">授权就绪</span>
              <span class="spacer"></span>
              <button type="button" class="btn sm" @click="openOAuthPage">重新打开授权页</button>
              <button type="button" class="btn sm" @click="oauthExpireDemo">模拟过期</button>
              <button type="button" class="btn sm" @click="disconnectOAuth">重置</button>
            </div>

            <!-- 已过期 (Expired - 不阻断保存) -->
            <div v-else-if="oauthState === 'expired'" class="oa-state oa-expired-row">
              <span class="dot y"></span>
              <b class="oa-warn">授权已过期，请重新授权</b>
              <span class="oa-warn hint-txt">（过期只影响运行时可用，不影响你继续编辑表单）</span>
              <span class="spacer"></span>
              <button type="button" class="btn sm" @click="openOAuthPage">重新打开授权页</button>
              <button type="button" class="btn sm" @click="disconnectOAuth">重置</button>
            </div>
          </div>

          <div class="sub-lbl" style="margin-top: 12px;">Authorization Code / Redirect URL</div>
          <div class="input-wrap">
            <input
              v-model="formData.oauth_code"
              placeholder="请输入以 4/0Ad 开头的 Authorization Code 或完整 Redirect URL"
              autocomplete="off"
              @input="onOAuthCodeInput"
            />
          </div>
          <div class="hint-txt">
            粘贴 Authorization Code 或完整 Redirect URL，授权全程在表单内完成
          </div>
        </div>
      </div>

      <!-- 模块 1：模型配置 (核心模块 · 默认展开 open) -->
      <details class="modular-details model-details" open>
        <summary class="modular-summary">
          <div class="summary-left">
            <span class="mod-title">模型配置</span>
            <span class="tag-badge blue">默认展开</span>
          </div>
          <div class="summary-right">
            <span class="summary-meta" v-if="modelChips.length > 0">
              已配置 {{ modelChips.length }} 个模型
            </span>
          </div>
        </summary>
        <div class="modular-content">
          <!-- 可用模型列表 (标签流) -->
          <div class="field-box" id="fldModels">
            <div class="field-lbl models-head-lbl">
              <span class="lbl-left">
                可用模型列表
                <span class="tag-badge gray">{{ modelChips.length }} 个</span>
              </span>
              <span class="lbl-right">
                <button
                  v-if="modelChips.length > 0"
                  type="button"
                  class="btn sm"
                  @click="clearAllModels"
                >
                  清空标签
                </button>
                <button
                  type="button"
                  class="btn sm fetch-models-btn"
                  :disabled="fetchingModels"
                  title="拉回的模型自动追加到下方标签，已存在的模型不会重复添加"
                  @click="fetchModelList"
                >
                  <span v-if="fetchingModels" class="spin"></span>
                  <span v-else class="icon">⬇</span>
                  获取模型列表
                </button>
              </span>
            </div>

            <!-- 168px 固定高度标签流容器 -->
            <div class="chips-container-168" @click="focusChipInput">
              <span
                v-for="(modelName, idx) in modelChips"
                :key="modelName"
                class="chip-item"
              >
                <span class="nm">{{ modelName }}</span>
                <span class="remove-btn" title="移除" @click.stop="removeModelChip(idx)">×</span>
              </span>
              <input
                ref="chipInputRef"
                v-model="chipInputText"
                class="chip-inline-input"
                placeholder="输入模型名，空格/Enter/逗号落地"
                autocomplete="off"
                @keydown="onChipKeydown"
                @paste="onChipPaste"
                @blur="commitChipInput"
              />
            </div>

            <div v-if="fetchFailedGuide" class="hint-txt warn">
              获取失败：{{ fetchFailedGuide }}。你可以直接输入模型名并保存。
            </div>

            <div class="chipbar-footer">
              <span class="hint-txt">支持直接输入与远端批量拉取，超出 5 行内部滚动</span>
              <span class="spacer"></span>
            </div>
          </div>

          <!-- 默认模型配置 (必填 · 核心模型配置项) -->
          <div class="field-box default-model-box" style="margin-bottom:0;">
            <label class="field-lbl">
              默认模型 <span class="req">*</span>
            </label>
            <div class="combo-select-box">
              <div class="combo-top">
                <span class="ci">🔍</span>
                <input
                  v-model="defaultModelSearch"
                  placeholder="输入关键字过滤下方候选项..."
                  autocomplete="off"
                />
              </div>
              <select v-model="formData.default_model" class="native-select">
                <option value="">（请选择默认兜底模型 · 必填）</option>
                <option
                  v-for="name in filteredDefaultModelCandidates"
                  :key="name"
                  :value="name"
                >
                  {{ name }}
                </option>
              </select>
            </div>
            <div class="hint-txt" :class="{ bad: !formData.default_model }">
              {{ defaultModelHintText }}
            </div>
          </div>
        </div>
      </details>

      <!-- 模块 2：游客访问权限配置 (默认收起) -->
      <details class="modular-details guest-details" id="fldGuest">
        <summary class="modular-summary">
          <div class="summary-left">
            <span class="mod-title">游客访问权限</span>
            <span class="tag-badge purple">Guest</span>
          </div>
          <div class="summary-right">
            <span class="summary-meta">
              {{ guestModelList.length > 0 ? `已开放 ${guestModelList.length} 个模型` : '未开放' }}
            </span>
          </div>
        </summary>
        <div class="modular-content">
          <!-- 游客开放模型主体 -->
          <div class="sub-field-row guest-list-row">
            <div class="sub-lbl-bar">
              <label class="field-lbl">
                开放模型列表
                <span class="tag-badge" :class="guestModelList.length ? 'purple' : 'gray'">
                  已开放 {{ guestModelList.length }} 个
                </span>
              </label>
              <div class="quick-batch-btns" v-if="allAvailableModelNames.length > 0">
                <button type="button" class="link-btn" @click="addAllAvailableToGuest">全部开放</button>
                <span class="divider">·</span>
                <button type="button" class="link-btn danger" @click="guestModelList = []">清空</button>
              </div>
            </div>

            <div class="chips-container-92" @click="focusGuestInput">
              <span
                v-for="(name, gIdx) in guestModelList"
                :key="name"
                class="chip-item"
              >
                <span class="nm">{{ name }}</span>
                <span class="remove-btn" title="移除" @click.stop="removeGuestModel(gIdx)">×</span>
              </span>
              <input
                ref="guestInputRef"
                v-model="guestInputText"
                class="chip-inline-input"
                placeholder="直接输入全称 + 空格/回车加入"
                autocomplete="off"
                @keydown="onGuestKeydown"
                @paste="onGuestPaste"
                @blur="commitGuestInput"
              />
            </div>
            <div class="hint-txt">
              {{ guestModelList.length > 0 ? `当前对游客开放 ${guestModelList.length} 个模型；未包含的模型仅对登录用户开放。` : '当前未配置任何开放模型（游客将无法进行对话）。' }}
            </div>
          </div>

          <!-- 辅助面板：从已配置模型中快速导入 -->
          <div class="guest-import-panel" v-if="allAvailableModelNames.length > 0">
            <div class="import-panel-header">
              <span class="panel-tit">从已配置模型快速添加：</span>
              <div class="import-search-box">
                <input
                  v-model="kwFilterQuery"
                  placeholder="按名称过滤（如 gpt、flash、r1）..."
                  class="import-input"
                />
                <button
                  type="button"
                  class="btn xs"
                  :disabled="!matchedKwHits.length"
                  @click="addAllKwHitsToGuest"
                >
                  添加匹配项 ({{ matchedKwHits.length }})
                </button>
              </div>
            </div>

            <!-- 点选候选流 -->
            <div class="candidates-flow">
              <span
                v-for="cand in displayedCandidates"
                :key="cand"
                class="cand-pill"
                :class="{ on: guestModelList.includes(cand) }"
                @click="toggleGuestModel(cand)"
                :title="guestModelList.includes(cand) ? '点击移出游客模型' : '点击加入游客模型'"
              >
                {{ cand }} <span class="pill-check">{{ guestModelList.includes(cand) ? '✓' : '+' }}</span>
              </span>
            </div>
          </div>
        </div>
      </details>

      <!-- 模块 3：高级设置 (默认收起) -->
      <details class="modular-details adv-details">
        <summary class="modular-summary">
          <div class="summary-left">
            <span class="mod-title">高级设置</span>
            <span class="tag-badge gray">可选</span>
          </div>
        </summary>
        <div class="modular-content">
          <div class="field-box">
            <label class="field-lbl">搜索关键词 / 中文别名</label>
            <div class="input-wrap">
              <input v-model="formData.alias" placeholder="例如 深度求索、ds" autocomplete="off" />
            </div>
            <div class="hint-txt">仅作为搜索服务商时的匹配别名</div>
          </div>

          <div class="field-box enable-row">
            <label class="field-lbl">启用服务商</label>
            <el-switch v-model="formData.enable" />
          </div>

          <div v-if="formData.conn === 'oauth'" class="field-box force-reauth-box" style="margin-bottom:0;">
            <label class="field-lbl">
              强制重新授权 <span class="tag-badge gray">疑难排查</span>
            </label>
            <div class="reauth-row">
              <button type="button" class="btn sm" @click="oauthForceReauth">
                重新走一次 OAuth 授权流程
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>

    <!-- 底部状态栏与操作按钮 (双按钮彻底解耦) -->
    <template #footer>
      <div class="dialog-footer-v4">
        <div class="statuses-col">
          <span class="st-item" :class="connStatusClass">
            <i class="st-dot"></i>
            <span>{{ connStatusText }}</span>
          </span>
          <span class="st-item" :class="fetchStatusClass">
            <i class="st-dot"></i>
            <span>{{ fetchStatusText }}</span>
          </span>
          <span class="st-item" :class="testStatusClass">
            <i class="st-dot"></i>
            <span>{{ testStatusText }}</span>
          </span>
        </div>

        <div class="actions-row">
          <button type="button" class="btn ghost" @click="resetFormToClean">清空重填</button>
          <button
            type="button"
            class="btn test-btn"
            :disabled="testingConnection"
            @click="testConnectionProbe"
          >
            <span v-if="testingConnection" class="spin"></span>
            <span v-else class="icon">⚡</span>
            测试连接
          </button>
          <button
            type="button"
            class="btn primary save-btn"
            :disabled="!isFormValid || saving"
            :title="saveButtonTitle"
            @click="handleSave"
          >
            <span v-if="saving" class="spin"></span>
            保存
          </button>
          <span
            v-if="!isFormValid && !saving"
            class="save-disabled-reason"
            :title="formInvalidReason"
          >
            {{ formInvalidReason }}
          </span>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { configAPI } from "@/lib/configApi.js";
import { useConfigStore } from "@/stores/configStore.js";
import { getAvatarByAdapterType } from "@/utils/avatar.js";
import { ElMessage } from "element-plus";

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: "add" }, // 'add' | 'edit'
  type: { type: String, default: "openai" },
  adapter: { type: Object, default: null },
  instanceId: { type: String, default: "" },
});

const emit = defineEmits(["close", "submit"]);

const configStore = useConfigStore();

// 移动端检测
const isMobile = ref(false);
const checkMobile = () => { isMobile.value = window.innerWidth <= 768; };
checkMobile();
window.addEventListener("resize", checkMobile);
onBeforeUnmount(() => { window.removeEventListener("resize", checkMobile); });

// 常量定义
const DEFAULT_PROTO = "openai-chat";
const VERTEX_URL = "https://aiplatform.googleapis.com";
const OAUTH_URL = "https://cloudcode-pa.googleapis.com";

const PROTO_OPTIONS = [
  { value: "openai-chat", label: "OpenAI Chat Completions（默认）", short: "openai-chat", color: "#409eff", desc: "适用范围最广的协议，绝大多数第三方服务商兼容此接口", caps: ["chat", "streaming", "vision", "tools", "reasoning"] },
  { value: "openai-responses", label: "OpenAI Responses", short: "openai-responses", color: "#7c5cff", desc: "最新的适配器，自带服务商内置工具（如联网搜索），适配 Codex 类接口的模型服务", caps: ["chat", "streaming", "vision", "tools", "reasoning"] },
  { value: "anthropic-messages", label: "Anthropic Messages", short: "anthropic-messages", color: "#c1613e", desc: "Anthropic 官方协议，适配 Claude Code 一类接口的模型服务", caps: ["chat", "streaming", "vision", "tools", "thinking"] },
  { value: "gemini", label: "Gemini generateContent", short: "gemini", color: "#2f9e6f", desc: "Google 官方协议，支持多模态与安全设置", caps: ["chat", "streaming", "vision", "tools", "safetySettings"] },
];

const CONN_OPTIONS = [
  { value: "api-key", label: "API Key（默认）", endpoint: null, locked: false, allowedProtos: ["openai-chat", "openai-responses", "anthropic-messages", "gemini"] },
  { value: "vertex-express", label: "Vertex Express（API Key）", endpoint: VERTEX_URL, locked: false, allowedProtos: ["gemini"] },
  { value: "vertex-adc", label: "Vertex ADC（应用默认凭据）", endpoint: VERTEX_URL, locked: false, allowedProtos: ["gemini"] },
  { value: "oauth", label: "OAuth 授权", endpoint: OAUTH_URL, locked: true, allowedProtos: ["gemini"] },
];

import { matchPreset, PRESETS } from "@/utils/adapterPresets.js";

// 表单响应式数据
const formData = ref({
  name: "",
  url: "",
  conn: "api-key",
  proto: DEFAULT_PROTO,
  key: "",
  vx_project: "",
  vx_key: "",
  adc_project: "",
  adc_src: "adc",
  adc_json: "",
  oauth_code: "",
  models_api_key: "",
  models_base_url: "",
  default_model: "",
  alias: "",
  enable: true,
  extraSettings: {},
});

const showModelsConfig = ref(false);
const showModelsKeyText = ref(false);
const hasCustomModelsConfig = computed(() => {
  return !!(formData.value.models_api_key?.trim() || formData.value.models_base_url?.trim());
});

// 适配器元数据与动态厂商特化 Schema
const adapterMetadata = ref([]);

const fetchAdapterMetadata = async () => {
  try {
    const res = await configAPI.getAdapterTypes();
    if (res.code === 0 && res.data?.adapters) {
      adapterMetadata.value = res.data.adapters;
    }
  } catch (err) {
    console.warn("获取适配器元数据失败:", err);
  }
};

// 预设相关状态
const selectedPresetId = ref(null);
const presetAvatarFailures = ref(new Set());
const pdOpen = ref(false);
const pdSearchQuery = ref("");
const pdContainerRef = ref(null);
const pdSearchInputRef = ref(null);

const selectedPreset = computed(() => {
  return PRESETS.find((p) => p.id === selectedPresetId.value) || null;
});

const handlePresetAvatarError = (preset) => {
  if (!preset) return;
  presetAvatarFailures.value = new Set([
    ...presetAvatarFailures.value,
    preset.id,
  ]);
};

const isPresetAvatarFailed = (preset) =>
  Boolean(preset && presetAvatarFailures.value.has(preset.id));

const currentAvatarUrl = computed(() => {
  if (selectedPreset.value?.avatar) return selectedPreset.value.avatar;
  if (props.mode === "edit" && props.type) {
    return getAvatarByAdapterType(props.type);
  }
  return null;
});

const currentAvatarLetter = computed(() => {
  if (selectedPreset.value) return selectedPreset.value.letter;
  if (props.mode === "edit") {
    return (props.adapter?.name?.[0] || props.type?.[0] || "M").toUpperCase();
  }
  return "+";
});

const isCurrentAvatarFailed = computed(() => {
  const key = selectedPreset.value ? selectedPreset.value.id : props.type;
  return Boolean(key && presetAvatarFailures.value.has(key));
});

const handleCurrentAvatarError = () => {
  const key = selectedPreset.value ? selectedPreset.value.id : props.type;
  if (key) {
    presetAvatarFailures.value = new Set([...presetAvatarFailures.value, key]);
  }
};

const getProtoColor = (protoKey) => {
  const p = PROTO_OPTIONS.find((item) => item.value === protoKey);
  return p ? p.color : "#409eff";
};

const getProtoShort = (protoKey) => {
  const p = PROTO_OPTIONS.find((item) => item.value === protoKey);
  return p ? p.short : protoKey;
};

const filteredPresetGroups = computed(() => {
  const q = pdSearchQuery.value.trim().toLowerCase();
  const groups = {};
  PRESETS.forEach((p) => {
    if (!groups[p.group]) groups[p.group] = [];
    if (!q || `${p.name} ${p.id} ${p.kw} ${p.url} ${p.proto}`.toLowerCase().includes(q)) {
      groups[p.group].push(p);
    }
  });
  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([name, items]) => ({ name, items }));
});

const togglePd = () => {
  pdOpen.value = !pdOpen.value;
  if (pdOpen.value) {
    nextTick(() => { pdSearchInputRef.value?.focus(); });
  }
};

const applyPreset = (preset) => {
  selectedPresetId.value = preset.id;
  formData.value.name = preset.name;
  formData.value.proto = preset.proto;
  formData.value.conn = preset.conn || "api-key";
  formData.value.url = preset.url;
  formData.value.alias = preset.kw.split(" ").slice(1, 3).join("、");
  pdOpen.value = false;
  enforceMatrix();
  updateUrlLockState();
  ElMessage.success(`已应用预设：${preset.name}（协议与端点已填充，随时可改）`);
};

// 矩阵约束：Vertex / OAuth 仅支持 Gemini
const isConnDisabled = (connVal) => {
  const proto = formData.value.proto;
  if (connVal === "api-key") return false;
  return proto !== "gemini";
};

const isProtoDisabled = (protoVal) => {
  const conn = formData.value.conn;
  if (conn === "api-key") return false;
  return protoVal !== "gemini";
};

const enforceMatrix = () => {
  const conn = formData.value.conn;
  const proto = formData.value.proto;
  if (conn !== "api-key" && proto !== "gemini") {
    formData.value.conn = "api-key";
    ElMessage.warning("当前协议与所选连接方式不兼容，已切回 API Key");
  }
};

const onConnChange = () => {
  enforceMatrix();
  updateUrlLockState();
  if (formData.value.conn === "oauth") {
    resolveOAuthUrl();
  }
};

const onProtoChange = () => {
  enforceMatrix();
  updateUrlLockState();
};

// URL 锁定逻辑（仅 OAuth 强制锁定官方端点，Vertex 允许自定义 Base URL 反代）
const isUrlLocked = computed(() => {
  const conn = formData.value.conn;
  return conn === "oauth";
});

const updateUrlLockState = () => {
  const conn = formData.value.conn;
  if (conn === "vertex-express" || conn === "vertex-adc") {
    // 若当前 URL 为空或为 OAuth 端点，赋默认 Vertex 官方端点；不覆盖用户手写的自定义反代地址
    if (!formData.value.url || formData.value.url === OAUTH_URL) {
      formData.value.url = VERTEX_URL;
    }
  } else if (conn === "oauth") {
    formData.value.url = OAUTH_URL;
  }
};

// URL 校验（纯格式校验，无推断！）
const isValidHttpUrl = (val) => {
  if (!val || typeof val !== "string") return false;
  const s = val.trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) return false;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
};

const urlHasError = computed(() => {
  if (isUrlLocked.value) return false;
  return !!formData.value.url && !isValidHttpUrl(formData.value.url);
});

const urlHasWarning = ref(false);
const urlHintText = computed(() => {
  if (isUrlLocked.value) return "官方固定端点，只读自动生成";
  if (formData.value.conn === "vertex-express" || formData.value.conn === "vertex-adc") {
    return "默认端点 https://aiplatform.googleapis.com，支持填写自定义反代或网关地址";
  }
  if (!formData.value.url) return "粘贴或手写端点均可 —— 地址不参与协议判断";
  if (!isValidHttpUrl(formData.value.url)) return "请输入合法的 http:// 或 https:// 端点地址";
  return "粘贴或手写端点均可 —— 地址不参与协议判断";
});

const onUrlChange = () => {
  if (selectedPresetId.value) {
    const p = PRESETS.find((item) => item.id === selectedPresetId.value);
    if (p && formData.value.url.replace(/\/$/, "") !== p.url.replace(/\/$/, "")) {
      selectedPresetId.value = null;
    }
  }
};

// 协议信息与能力标签
const currentProtoDesc = computed(() => {
  const p = PROTO_OPTIONS.find((item) => item.value === formData.value.proto);
  return p ? p.desc : "";
});

const currentProtoCaps = computed(() => {
  const p = PROTO_OPTIONS.find((item) => item.value === formData.value.proto);
  return p ? p.caps : [];
});

const currentCredKindLabel = computed(() => {
  const opt = CONN_OPTIONS.find((item) => item.value === formData.value.conn);
  return opt ? opt.label : "凭据";
});

// 凭据显示控制
const showApiKeyText = ref(false);
const showVxKeyText = ref(false);

const apiKeyError = computed(() => {
  return formData.value.conn === "api-key" && formData.value.key && formData.value.key.length < 8;
});

const vxKeyError = computed(() => {
  return formData.value.conn === "vertex-express" && formData.value.vx_key && formData.value.vx_key.length < 8;
});

// ADC JSON 即时解析
const adcJsonParsed = ref({ valid: false, project_id: "", client_email: "", hasKey: false });
const onAdcJsonInput = () => {
  const raw = (formData.value.adc_json || "").trim();
  if (!raw) {
    adcJsonParsed.value = { valid: false, project_id: "", client_email: "", hasKey: false };
    return;
  }
  try {
    const obj = JSON.parse(raw);
    const valid = !!obj && typeof obj === "object" && (!!obj.project_id || !!obj.client_email || !!obj.private_key);
    adcJsonParsed.value = {
      valid,
      project_id: obj.project_id || "",
      client_email: obj.client_email || "",
      hasKey: !!obj.private_key,
    };
    if (valid && obj.project_id && !formData.value.adc_project) {
      formData.value.adc_project = obj.project_id;
    }
  } catch {
    adcJsonParsed.value = { valid: false, project_id: "", client_email: "", hasKey: false };
  }
};

// OAuth 授权状态机
const oauthState = ref("idle"); // 'idle' | 'pending' | 'done' | 'expired'
const oauthUserCode = ref("");
const oauthAccountEmail = ref("已授权 Google 账号");
const currentOAuthUrl = ref("");
const fetchingOAuthUrl = ref(false);

const oauthCardClass = computed(() => {
  if (oauthState.value === "done") return "on";
  if (oauthState.value === "expired") return "warn";
  return "";
});

const resolveOAuthUrl = async () => {
  if (currentOAuthUrl.value) return currentOAuthUrl.value;
  fetchingOAuthUrl.value = true;
  try {
    let adapters = configStore?.adapterTypes?.adapters || [];
    let oauthAdapter = adapters.find((a) => a.type === "geminiOauth");
    if (!oauthAdapter?.authUrl) {
      const res = await configStore.fetchAdapterTypes();
      adapters = res?.adapters || [];
      oauthAdapter = adapters.find((a) => a.type === "geminiOauth");
    }
    let url = oauthAdapter?.authUrl;
    if (!url && oauthAdapter?.description) {
      const match = oauthAdapter.description.match(/https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth[^\s\)]+/);
      if (match) url = match[0];
    }
    if (url) {
      currentOAuthUrl.value = url;
      return url;
    }
  } catch (err) {
    console.error("[OAuth] 获取授权链接失败:", err);
  } finally {
    fetchingOAuthUrl.value = false;
  }
  return "";
};

const openOAuthPage = async () => {
  const url = await resolveOAuthUrl();
  if (url) {
    try {
      const newWin = window.open(url, "_blank", "noopener,noreferrer");
      if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
        ElMessage.warning("浏览器已拦截弹窗，请点击界面中的备用链接手动打开");
      } else {
        ElMessage.success("已打开 Google 授权窗口，完成授权后请将浏览器跳转地址或 Code 粘贴回填");
      }
    } catch {
      ElMessage.warning("请点击'直接打开链接 ↗'完成授权");
    }
  } else {
    ElMessage.error("未获取到 Google 授权链接，请检查后端服务是否正常");
  }
};

const startOAuth = async () => {
  oauthState.value = "pending";
  await openOAuthPage();
};

const copyOAuthCode = () => {
  if (currentOAuthUrl.value) {
    navigator.clipboard?.writeText(currentOAuthUrl.value);
    ElMessage.success("已复制 Google 授权链接");
  } else if (oauthUserCode.value) {
    navigator.clipboard?.writeText(oauthUserCode.value);
    ElMessage.success("已复制 User Code: " + oauthUserCode.value);
  }
};

const oauthExpireDemo = () => {
  oauthState.value = "expired";
  ElMessage.warning("模拟令牌已过期：卡片变黄，但不会阻断表单保存");
};

const disconnectOAuth = () => {
  oauthState.value = "idle";
  oauthUserCode.value = "";
  formData.value.oauth_code = "";
  formData.value.key = "";
  ElMessage.info("已重置 Google 账号授权状态");
};

const oauthForceReauth = () => {
  if (formData.value.conn !== "oauth") {
    ElMessage.warning("仅在连接方式为 OAuth 授权时生效");
    return;
  }
  startOAuth();
};

const onOAuthCodeInput = () => {
  const v = (formData.value.oauth_code || "").trim();
  if (v.includes("4/0Ad") || v.includes("4/") || v.includes("code=")) {
    oauthState.value = "done";
    oauthAccountEmail.value = "已识别授权码";
    ElMessage.success("已识别 Authorization Code，授权完成");
  }
};

// ==================== 模型标签流 (168px) ====================
const modelChips = ref([]); // string[]
const chipInputText = ref("");
const chipInputRef = ref(null);
const fetchingModels = ref(false);
const fetchFailedGuide = ref("");

const allAvailableModelNames = computed(() => modelChips.value.slice());

const focusChipInput = () => { chipInputRef.value?.focus(); };

const parseDelimitedText = (text) => {
  return String(text || "")
    .split(/[\s,，;；\n\r\t|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

const addModelsToChips = (names) => {
  let added = 0;
  names.forEach((raw) => {
    const name = String(raw).trim();
    if (!name) return;
    if (!modelChips.value.includes(name)) {
      modelChips.value.push(name);
      added++;
    }
  });
  return added;
};

const commitChipInput = () => {
  const txt = chipInputText.value.trim();
  if (!txt) return;
  const list = parseDelimitedText(txt);
  addModelsToChips(list);
  chipInputText.value = "";
};

const onChipKeydown = (e) => {
  const isSep = [" ", "Enter", ",", "，", ";", "；"].includes(e.key);
  if (isSep) {
    if (chipInputText.value.trim()) {
      e.preventDefault();
      commitChipInput();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
    }
    return;
  }
  if (e.key === "Backspace" && !chipInputText.value && modelChips.value.length > 0) {
    modelChips.value.pop();
  }
};

const onChipPaste = (e) => {
  const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  if (!pasted.trim()) return;
  e.preventDefault();
  const list = parseDelimitedText(pasted);
  const added = addModelsToChips(list);
  chipInputText.value = "";
  ElMessage.success(`粘贴解析出 ${list.length} 个模型（新落地 ${added} 个）`);
};

const removeModelChip = (idx) => {
  const removed = modelChips.value.splice(idx, 1)[0];
  if (formData.value.default_model === removed) {
    formData.value.default_model = modelChips.value.length ? modelChips.value[0] : "";
  }
  guestModelList.value = guestModelList.value.filter((name) => name !== removed);
};

const clearAllModels = () => {
  modelChips.value = [];
  formData.value.default_model = "";
  guestModelList.value = [];
  ElMessage.info("已清空模型标签");
};

// 拉取模型列表 (双按钮解耦)
const fetchStatus = ref({ state: "idle", text: "模型列表：未获取" });
const fetchModelList = async () => {
  if (!isValidHttpUrl(formData.value.url)) {
    ElMessage.warning("请先填写合法的 Base URL");
    return;
  }
  fetchingModels.value = true;
  fetchFailedGuide.value = "";
  fetchStatus.value = { state: "run", text: "模型列表：正在拉取..." };

  try {
    const targetType = determineBackendAdapterType();
    const payload = buildProbePayload();
    const res = await configAPI.fetchLLMModels(targetType, payload);

    let modelsArr = [];
    if (res?.data?.models && Array.isArray(res.data.models)) {
      res.data.models.forEach((item) => {
        if (typeof item === "string") modelsArr.push(item);
        else if (item?.id || item?.name) modelsArr.push(item.id || item.name);
        else if (Array.isArray(item?.models)) item.models.forEach((m) => modelsArr.push(typeof m === "string" ? m : m.id || m.name));
      });
    }

    modelsArr = [...new Set(modelsArr.filter(Boolean))];
    if (modelsArr.length > 0) {
      const added = addModelsToChips(modelsArr);
      fetchStatus.value = { state: "ok", text: `模型列表：已拉取 ${modelsArr.length} 个（新落地 ${added}）` };
      ElMessage.success(`成功拉取并落地 ${modelsArr.length} 个模型（新落地 ${added}）`);
      if (!formData.value.default_model && modelChips.value.length > 0) {
        formData.value.default_model = modelChips.value[0];
      }
    } else {
      fetchStatus.value = { state: "warn", text: "模型列表：拉取结果为空" };
      fetchFailedGuide.value = "拉取结果为空";
      ElMessage.warning("获取模型列表为空，可直接手动输入模型名");
    }
  } catch (err) {
    fetchStatus.value = { state: "warn", text: `模型列表：获取失败 (${err.message || '网络错误'})` };
    fetchFailedGuide.value = err.message || "请求失败";
    ElMessage.warning(`获取模型失败：${err.message || err}（不影响您直接输入模型名保存）`);
  } finally {
    fetchingModels.value = false;
  }
};

// ==================== 游客模型配置 ====================
const defaultModelSearch = ref("");
const kwFilterQuery = ref("");
const guestModelList = ref([]); // string[]
const guestInputText = ref("");
const guestInputRef = ref(null);

const filteredDefaultModelCandidates = computed(() => {
  const q = defaultModelSearch.value.trim().toLowerCase();
  const all = allAvailableModelNames.value;
  if (!q) return all;
  return all.filter((n) => n.toLowerCase().includes(q));
});

const defaultModelHintText = computed(() => {
  if (!allAvailableModelNames.value.length) return "必填：请先在上方「模型列表」中添加标签（或点击「获取模型列表」）";
  if (!formData.value.default_model) return "必填：请选择一个默认模型";
  return `必填 · 下拉选项来自上方模型标签（共 ${allAvailableModelNames.value.length} 个）`;
});

const matchedKwHits = computed(() => {
  const q = kwFilterQuery.value.trim().toLowerCase();
  if (!q) return [];
  return allAvailableModelNames.value.filter((n) => n.toLowerCase().includes(q));
});

const displayedCandidates = computed(() => {
  const q = kwFilterQuery.value.trim().toLowerCase();
  const all = allAvailableModelNames.value;
  if (!q) return all;
  return all.filter((n) => n.toLowerCase().includes(q));
});

const addAllAvailableToGuest = () => {
  const set = new Set(guestModelList.value);
  allAvailableModelNames.value.forEach((m) => set.add(m));
  guestModelList.value = Array.from(set);
  ElMessage.success(`已开放全部 ${guestModelList.value.length} 个模型`);
};

const addAllKwHitsToGuest = () => {
  const hits = matchedKwHits.value;
  if (!hits.length) return;
  let added = 0;
  hits.forEach((name) => {
    if (!guestModelList.value.includes(name)) {
      guestModelList.value.push(name);
      added++;
    }
  });
  ElMessage.success(`已加入 ${hits.length} 个命中模型（新增 ${added}）`);
};

const toggleGuestModel = (name) => {
  const idx = guestModelList.value.indexOf(name);
  if (idx >= 0) guestModelList.value.splice(idx, 1);
  else guestModelList.value.push(name);
};

const focusGuestInput = () => { guestInputRef.value?.focus(); };

const commitGuestInput = () => {
  const txt = guestInputText.value.trim();
  if (!txt) return;
  const list = parseDelimitedText(txt);
  list.forEach((n) => {
    if (!guestModelList.value.includes(n)) guestModelList.value.push(n);
  });
  guestInputText.value = "";
};

const onGuestKeydown = (e) => {
  const isSep = [" ", "Enter", ",", "，", ";", "；"].includes(e.key);
  if (isSep) {
    if (guestInputText.value.trim()) {
      e.preventDefault();
      commitGuestInput();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
    }
    return;
  }
  if (e.key === "Backspace" && !guestInputText.value && guestModelList.value.length > 0) {
    guestModelList.value.pop();
  }
};

const onGuestPaste = (e) => {
  const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  if (!pasted.trim()) return;
  e.preventDefault();
  const list = parseDelimitedText(pasted);
  list.forEach((n) => {
    if (!guestModelList.value.includes(n)) guestModelList.value.push(n);
  });
  guestInputText.value = "";
  ElMessage.success(`已落地 ${list.length} 个全称到 guest_models`);
};

const removeGuestModel = (gIdx) => {
  guestModelList.value.splice(gIdx, 1);
};

// ==================== 底部解耦状态与测试连接 ====================
const testStatus = ref({ state: "idle", text: "连接：未测试" });
const testingConnection = ref(false);
const saving = ref(false);

const connStatusText = computed(() => {
  const c = formData.value.conn;
  if (c === "api-key") {
    return formData.value.key ? "连接方式：API Key · 凭据已填写" : "连接方式：API Key · 待填写";
  }
  if (c === "vertex-express") {
    const ok = !!formData.value.vx_project && !!formData.value.vx_key;
    return `连接方式：Vertex Express · 凭据完整度 ${ok ? '2/2' : '待完善'}`;
  }
  if (c === "vertex-adc") {
    const ok = !!formData.value.adc_project && (formData.value.adc_src === 'adc' || adcJsonParsed.value.valid);
    return `连接方式：Vertex ADC · 凭据完整度 ${ok ? '2/2' : '待完善'}`;
  }
  if (c === "oauth") {
    return `连接方式：OAuth · ${oauthState.value === 'done' ? '已授权' : oauthState.value === 'expired' ? '授权已过期' : '未授权'}`;
  }
  return "连接方式：未选";
});

const connStatusClass = computed(() => {
  const c = formData.value.conn;
  if (c === "api-key") return formData.value.key ? "ok" : "";
  if (c === "vertex-express") return (formData.value.vx_project && formData.value.vx_key) ? "ok" : "warn";
  if (c === "vertex-adc") return (formData.value.adc_project && (formData.value.adc_src === 'adc' || adcJsonParsed.value.valid)) ? "ok" : "warn";
  if (c === "oauth") return oauthState.value === "done" ? "ok" : oauthState.value === "expired" ? "warn" : "";
  return "";
});

const fetchStatusText = computed(() => fetchStatus.value.text);
const fetchStatusClass = computed(() => fetchStatus.value.state);

const testStatusText = computed(() => testStatus.value.text);
const testStatusClass = computed(() => testStatus.value.state);

// 连通性测试 (Probe)
const testConnectionProbe = async () => {
  const targetModel = formData.value.default_model || modelChips.value[0];
  if (!targetModel) {
    ElMessage.warning("请在配置面板中选择或指定要测试的默认模型");
    return;
  }
  if (!isValidHttpUrl(formData.value.url)) {
    ElMessage.warning("请先填写合法的 Base URL");
    return;
  }

  testingConnection.value = true;
  testStatus.value = { state: "run", text: `连接：正在握手探活 (${targetModel})...` };

  try {
    const targetType = determineBackendAdapterType();
    const payload = buildProbePayload();
    payload.model = targetModel;

    const res = await configAPI.testLLMConnection(targetType, payload);
    if (res?.data?.success) {
      const ms = res.data.latencyMs ?? 120;
      testStatus.value = { state: "ok", text: `连接：成功 · ${ms}ms · PONG · 模型 ${targetModel}` };
      ElMessage.success(`连接测试成功 (延迟: ${ms}ms, 模型: ${targetModel})`);
    } else {
      testStatus.value = { state: "bad", text: `连接：失败 · ${res?.data?.message || '测试失败'}` };
      ElMessage.error(res?.data?.message || "连接测试失败");
    }
  } catch (err) {
    testStatus.value = { state: "bad", text: `连接：失败 · ${err.message || '网络错误'}` };
    ElMessage.error(`连接测试失败：${err.message || err}`);
  } finally {
    testingConnection.value = false;
  }
};

// 表单有效性校验：同时返回可直接展示给用户的阻塞原因。
const formInvalidReason = computed(() => {
  if (!isValidHttpUrl(formData.value.url)) return "请填写合法的 Base URL";
  if (!formData.value.proto) return "请选择协议";
  if (!formData.value.default_model) return "请选择默认模型";

  const c = formData.value.conn;
  if (c === "api-key" && !formData.value.key?.trim()) {
    return "请填写 API Key";
  }
  if (c === "vertex-express") {
    if (!formData.value.vx_project?.trim()) return "请填写 Vertex project_id";
    if (!formData.value.vx_key?.trim()) return "请填写 Vertex API Key";
  }
  if (c === "vertex-adc") {
    if (!formData.value.adc_project?.trim()) return "请填写 Vertex project_id";
    if (formData.value.adc_src === "json" && !adcJsonParsed.value.valid) {
      return "请填写有效的 service account JSON";
    }
  }
  if (
    c === "oauth" &&
    oauthState.value !== "done" &&
    oauthState.value !== "expired" &&
    !formData.value.oauth_code
  ) {
    return "请完成 OAuth 授权或填写 Authorization Code";
  }
  return "";
});

const isFormValid = computed(() => !formInvalidReason.value);
const saveButtonTitle = computed(() =>
  saving.value ? "正在保存..." : formInvalidReason.value || "保存当前配置",
);

// 后端适配器类型映射
const determineBackendAdapterType = () => {
  const c = formData.value.conn;
  if (c === "oauth") return "geminiOauth";
  if (c === "vertex-express" || c === "vertex-adc") return "agentPlatform";

  // conn === 'api-key'
  // 唯独 xAI 拥有独有的推文搜索与参数修剪逻辑，走定制适配器类
  if ((selectedPresetId.value === "xai" || (props.mode === "edit" && props.type === "xai")) && formData.value.proto === "openai-responses") {
    return "xai";
  }

  const p = formData.value.proto;
  if (p === "openai-responses") return "openai-responses";
  if (p === "anthropic-messages") return "anthropic";
  if (p === "gemini") return "gemini";
  return "openai";
};

const currentTargetAdapterType = computed(() => {
  return determineBackendAdapterType();
});

// 探活与测试 Payload 构建
const buildProbePayload = () => {
  const c = formData.value.conn;
  const payload = {
    base_url: formData.value.url.trim(),
    name: formData.value.name.trim() || undefined,
  };
  if (props.instanceId) payload.instanceId = props.instanceId;
  if (c === "api-key") {
    payload.api_key = formData.value.key.trim();
  } else if (c === "vertex-express") {
    payload.project_id = formData.value.vx_project.trim();
    payload.api_key = formData.value.vx_key.trim();
    payload.block_express = false;
    if (formData.value.models_api_key?.trim()) {
      payload.models_api_key = formData.value.models_api_key.trim();
    }
    if (formData.value.models_base_url?.trim()) {
      payload.models_base_url = formData.value.models_base_url.trim();
    }
  } else if (c === "vertex-adc") {
    payload.project_id = formData.value.adc_project.trim();
    payload.block_express = true;
    if (formData.value.adc_src === "json") {
      payload.credentials = formData.value.adc_json.trim();
    }
    if (formData.value.models_api_key?.trim()) {
      payload.models_api_key = formData.value.models_api_key.trim();
    }
    if (formData.value.models_base_url?.trim()) {
      payload.models_base_url = formData.value.models_base_url.trim();
    }
  } else if (c === "oauth") {
    payload.api_key = formData.value.oauth_code?.trim() || formData.value.key?.trim() || "";
  }
  return payload;
};

// 保存提交
const handleSave = async () => {
  if (!isFormValid.value) {
    ElMessage.warning(formInvalidReason.value || "请先填写完必填项");
    return;
  }

  saving.value = true;
  try {
    const targetType = determineBackendAdapterType();
    const finalPayload = {
      name: formData.value.name.trim() || autoGenerateName(),
      enable: formData.value.enable,
      base_url: formData.value.url.trim(),
      proto: formData.value.proto,
      conn: formData.value.conn,
      default_model: formData.value.default_model,
      models: modelChips.value.slice(),
      guest_models: guestModelList.value.slice(),
      alias: formData.value.alias.trim() || undefined,
    };

    if (formData.value.extraSettings && Object.keys(formData.value.extraSettings).length > 0) {
      finalPayload.extraSettings = JSON.parse(JSON.stringify(formData.value.extraSettings));
    }

    const c = formData.value.conn;
    if (c === "api-key") {
      finalPayload.api_key = formData.value.key.trim();
    } else if (c === "vertex-express") {
      finalPayload.project_id = formData.value.vx_project.trim();
      finalPayload.api_key = formData.value.vx_key.trim();
      finalPayload.block_express = false;
      if (formData.value.models_api_key?.trim()) {
        finalPayload.models_api_key = formData.value.models_api_key.trim();
      }
      if (formData.value.models_base_url?.trim()) {
        finalPayload.models_base_url = formData.value.models_base_url.trim();
      }
    } else if (c === "vertex-adc") {
      finalPayload.project_id = formData.value.adc_project.trim();
      finalPayload.block_express = true;
      if (formData.value.adc_src === "json" && formData.value.adc_json.trim()) {
        finalPayload.credentials = formData.value.adc_json.trim();
      }
      if (formData.value.models_api_key?.trim()) {
        finalPayload.models_api_key = formData.value.models_api_key.trim();
      }
      if (formData.value.models_base_url?.trim()) {
        finalPayload.models_base_url = formData.value.models_base_url.trim();
      }
    } else if (c === "oauth") {
      const codeOrKey = formData.value.oauth_code?.trim() || formData.value.key?.trim() || "";
      if (codeOrKey) {
        finalPayload.api_key = codeOrKey;
      }
      if (formData.value.oauth_code?.trim()) {
        finalPayload.oauth_code = formData.value.oauth_code.trim();
      }
    }

    await emit("submit", {
      type: targetType,
      instanceId: props.instanceId || props.adapter?.id || "",
      data: finalPayload,
      mode: props.mode,
    });

    handleClose();
  } catch (err) {
    // 错误在外部提示
  } finally {
    saving.value = false;
  }
};

const autoGenerateName = () => {
  if (selectedPresetId.value) return `${selectedPresetId.value}-1`;
  try {
    const u = new URL(formData.value.url);
    const host = u.hostname.replace(/^www\.|^api\./, "").split(".")[0];
    if (host) return `${host}-1`;
  } catch {
    // ignore
  }
  return "custom-1";
};

// 对话框标题
const dialogTitle = computed(() => {
  if (props.mode === "add") return "添加服务商";
  return `编辑服务商：${props.adapter?.name || props.type}`;
});

const handleClose = () => {
  emit("close");
};

// 清空重填
const resetFormToClean = () => {
  selectedPresetId.value = null;
  pdOpen.value = false;
  pdSearchQuery.value = "";
  formData.value = {
    name: "",
    url: "",
    conn: "api-key",
    proto: DEFAULT_PROTO,
    key: "",
    vx_project: "",
    vx_key: "",
    adc_project: "",
    adc_src: "adc",
    adc_json: "",
    oauth_code: "",
    models_api_key: "",
    models_base_url: "",
    default_model: "",
    alias: "",
    enable: true,
    extraSettings: {},
  };
  showModelsConfig.value = false;
  showModelsKeyText.value = false;
  modelChips.value = [];
  chipInputText.value = "";
  guestModelList.value = [];
  guestInputText.value = "";
  kwFilterQuery.value = "";
  defaultModelSearch.value = "";
  oauthState.value = "idle";
  oauthUserCode.value = "";
  currentOAuthUrl.value = "";
  adcJsonParsed.value = { valid: false, project_id: "", client_email: "", hasKey: false };
  fetchStatus.value = { state: "idle", text: "模型列表：未获取" };
  testStatus.value = { state: "idle", text: "连接：未测试" };
  fetchFailedGuide.value = "";
  ElMessage.info("表单已重置");
};

// 数据回显 (编辑模式 vs 添加模式)
const initFromProps = () => {
  if (props.mode === "edit" && props.adapter) {
    const a = props.adapter;
    const t = props.type;

    // 1. 判断连接方式与协议（优先从实例自身已保存的 proto / conn 读取）
    let conn = a.conn || "";
    let proto = a.proto || "";

    if (!conn) {
      if (t === "geminiOauth") {
        conn = "oauth";
      } else if (t === "agentPlatform" || t === "vertexExpress" || t === "vertex") {
        conn = (a.block_express || !a.api_key) ? "vertex-adc" : "vertex-express";
      } else {
        conn = "api-key";
      }
    }

    if (t === "geminiOauth" || conn === "oauth") {
      oauthState.value = "done";
      proto = "gemini";
      resolveOAuthUrl();
    } else if (!proto) {
      if (t === "gemini" || t === "agentPlatform" || t === "vertexExpress" || t === "vertex") {
        proto = "gemini";
      } else if (t === "anthropic") {
        proto = "anthropic-messages";
      } else if (t === "openai-responses" || t === "volcengine" || t === "xai") {
        proto = "openai-responses";
      } else {
        proto = "openai-chat";
      }
    }

    // 匹配预设 (智能按 URL/关键词/类型匹配对应品牌预设)
    const matchedPreset = matchPreset(a, t);
    selectedPresetId.value = matchedPreset ? matchedPreset.id : null;

    formData.value.name = a.name || "";
    formData.value.proto = proto;
    formData.value.conn = conn;
    formData.value.url = a.base_url || "";
    formData.value.key = a.api_key || "";
    formData.value.vx_project = a.project_id || "";
    formData.value.vx_key = a.api_key || "";
    formData.value.adc_project = a.project_id || "";
    formData.value.adc_src = a.credentials ? "json" : "adc";
    formData.value.adc_json = typeof a.credentials === "string" ? a.credentials : a.credentials ? JSON.stringify(a.credentials, null, 2) : "";
    formData.value.models_api_key = a.models_api_key || "";
    formData.value.models_base_url = a.models_base_url || "";
    showModelsConfig.value = !!(a.models_api_key || a.models_base_url);
    formData.value.default_model = a.default_model || "";
    formData.value.alias = a.alias || "";
    formData.value.enable = a.enable !== false;
    formData.value.extraSettings = a.extraSettings ? JSON.parse(JSON.stringify(a.extraSettings)) : {};

    if (formData.value.adc_json) {
      onAdcJsonInput();
    }

    updateUrlLockState();

    // 回显模型列表
    const chips = [];
    if (Array.isArray(a.models)) {
      a.models.forEach((m) => {
        const nm = typeof m === "string" ? m : m.name || m.id;
        if (nm) chips.push(nm);
      });
    }
    modelChips.value = chips;
    if (!formData.value.default_model && modelChips.value.length > 0) {
      formData.value.default_model = modelChips.value[0];
    }

    // 回显游客模型
    if (Array.isArray(a.guest_models)) {
      guestModelList.value = a.guest_models.slice();
    } else if (a.guest_models?.full_name && Array.isArray(a.guest_models.full_name)) {
      guestModelList.value = a.guest_models.full_name.slice();
    } else {
      guestModelList.value = [];
    }

    fetchStatus.value = { state: "idle", text: `模型列表：已载入 ${chips.length} 个` };
    testStatus.value = { state: "idle", text: "连接：未测试" };
  } else {
    resetFormToClean();
  }
};

watch(
  () => props.visible,
  (val) => {
    if (val) {
      fetchAdapterMetadata();
      initFromProps();
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
// 桌面端模型服务编辑器下移到 5vh；移动端保持现有全屏布局。
@media (min-width: 769px) {
  :global(.v4-editor-dialog) {
    --el-dialog-margin-top: 5vh !important;
  }
}

.v4-editor-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.dialog-scroll-body {
  max-height: calc(85vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 22px;
  font-size: 13.5px;
  color: #303133;
}

.note-banner {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 12.6px;
  line-height: 1.7;
  border: 1px solid #d9ecff;
  background: #f4faff;
  color: #3d5a80;
  margin-bottom: 16px;

  &.mini {
    padding: 9px 12px;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .ico {
    font-weight: 700;
    color: #409eff;
  }
}

.field-box {
  margin-bottom: 16px;
}

.field-lbl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 7px;
  font-weight: 600;
  flex-wrap: wrap;

  .req {
    color: #f56c6c;
    font-size: 12px;
  }
}

.sub-lbl {
  font-size: 12.5px;
  color: #606266;
  font-weight: 550;
  margin-bottom: 6px;

  .req {
    color: #f56c6c;
  }
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 6px;
  font-size: 11.5px;
  line-height: 1.7;
  white-space: nowrap;

  &.gray { background: #f4f4f5; color: #909399; }
  &.blue { background: #ecf5ff; color: #409eff; border: 1px solid #d9ecff; }
  &.purple { background: #f3f0ff; color: #6b4ee6; border: 1px solid #e5ddff; }
  &.green { background: #f0f9eb; color: #529b2e; border: 1px solid #e1f3d8; }
}

.input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 9px;
  background: #fff;
  transition: all 0.16s;

  &:focus-within {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
  }

  &.locked {
    background: #f7f8fa;
    border-style: dashed;
    input { color: #7a8290; }
  }

  &.err {
    border-color: #f56c6c;
    box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.12);
  }

  input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    outline: 0;
    font-size: 13.5px;
    font-family: inherit;
    background: transparent;
    color: #303133;
    height: 36px;
  }

  .addon-btn {
    flex: 0 0 auto;
    color: #909399;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    padding: 2px 6px;

    &:hover { color: #409eff; }
    &.disabled { color: #c0c4cc; cursor: not-allowed; }
  }
}

.hint-txt {
  font-size: 12px;
  color: #a8abb2;
  margin-top: 6px;
  line-height: 1.65;

  &.warn { color: #e6a23c; }
  &.bad { color: #f56c6c; }
  &.ok { color: #529b2e; }
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.8px;
}

// 预设下拉
.pd-container {
  position: relative;
}

.pd-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.16s;
  font-family: inherit;
  text-align: left;

  &:hover {
    border-color: #b3d8ff;
    background: #fafcff;
  }

  &.open {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
    .caret { transform: rotate(180deg); }
  }

  .ava {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #e4e7ed;
    color: #303133;
    font-weight: 650;
    font-size: 13px;
    flex-shrink: 0;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }
  }

  .txt {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 13.5px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.ph { color: #a8abb2; }
  }

  .caret {
    color: #c0c4cc;
    font-size: 11px;
    transition: transform 0.2s;
  }
}

.pd-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.16);
  z-index: 50;
  padding: 8px;

  .srch {
    padding: 2px 2px 8px;
    input {
      width: 100%;
      height: 34px;
      border: 1px solid #e4e7ed;
      border-radius: 8px;
      padding: 0 11px;
      font-size: 13px;
      outline: 0;
      font-family: inherit;
      &:focus { border-color: #409eff; }
    }
  }

  .pd-list {
    max-height: 280px;
    overflow-y: auto;
  }

  .pd-group-title {
    font-size: 11.5px;
    color: #a8abb2;
    padding: 8px 8px 4px;
    letter-spacing: 0.4px;
  }

  .pd-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 9px;
    border-radius: 9px;
    cursor: pointer;
    transition: background 0.13s;

    &:hover { background: #f2f7ff; }

    .ava {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      border: 1px solid #e4e7ed;
      color: #303133;
      font-size: 12px;
      font-weight: 650;
      flex-shrink: 0;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }
    }

    .mid {
      flex: 1 1 auto;
      min-width: 0;
      .nm {
        font-size: 13px;
        font-weight: 550;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .url {
        font-size: 11.5px;
        color: #a8abb2;
        margin-top: 1px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .empty-hint {
    padding: 20px;
    text-align: center;
    color: #a8abb2;
    font-size: 12.5px;
  }
}

.row-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.native-select {
  width: 100%;
  height: 38px;
  border: 1px solid #dcdfe6;
  border-radius: 9px;
  background: #fff;
  color: #303133;
  font-size: 13.5px;
  font-family: inherit;
  padding: 0 10px;
  outline: 0;
  cursor: pointer;
  transition: border-color 0.16s;

  &:hover { border-color: #b3d8ff; }
  &:focus {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
  }
}

.proto-info-row {
  margin: -6px 0 14px;

  .proto-desc {
    margin-bottom: 6px;
  }

  .proto-caps {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }
}

.matrix-note {
  font-size: 11.5px;
  color: #b0b6c0;
  font-weight: 400;
  margin-left: auto;
}

// 凭据区
.cred-card {
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fbfcfe;
  padding: 12px;
}

.cred-studio-models {
  margin-top: 12px;
  border: 1px dashed #dcdfe6;
  background: #fafbfc;
  transition: all 0.2s ease;

  .studio-models-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
    padding: 2px 0;

    .head-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .toggle-arrow {
        font-size: 11px;
        color: #909399;
        transition: transform 0.2s;
        display: inline-block;
        width: 14px;
      }
    }

    .head-right {
      .hint-txt {
        color: #409eff;
        font-size: 12px;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }

  .studio-models-body {
    padding-top: 4px;
    border-top: 1px solid #f0f2f5;
    margin-top: 8px;
  }
}

.ta-json {
  width: 100%;
  min-height: 96px;
  border: 1px solid #dcdfe6;
  border-radius: 9px;
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  outline: 0;
  resize: vertical;
  background: #fff;
  color: #303133;
  transition: all 0.16s;

  &:focus {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
  }

  &.err {
    border-color: #f56c6c;
    box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.12);
  }
}

.sa-summary {
  margin-top: 8px;
  font-size: 12.2px;
  line-height: 1.8;
  color: #606266;
  background: #fff;
  border: 1px dashed #e4e7ed;
  border-radius: 8px;
  padding: 8px 10px;

  .k { color: #a8abb2; margin-right: 4px; }
  &.ok { border-style: solid; border-color: #e1f3d8; background: #f7fdf3; }
  &.bad { border-style: solid; border-color: #fde2e2; background: #fff8f8; color: #c45656; }
}

.oauth-card {
  border: 1px dashed #dcdfe6;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
  transition: all 0.2s;

  &.on { border-style: solid; border-color: #d9ecff; background: #f7fbff; }
  &.warn { border-style: solid; border-color: #f3d19e; background: #fffbf2; }
}

.oa-state {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oa-pending-row,
.oa-done-row,
.oa-expired-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.usercode {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #409eff;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 8px;
  padding: 4px 10px;
}

.oauth-btn {
  min-height: 40px;
  font-size: 14px;
}

.oa-warn {
  color: #b88230;
  font-size: 12.5px;
}

.oa-link {
  font-size: 13px;
  color: var(--primary-color, #409eff);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.08);
  transition: all 0.2s;

  &:hover {
    background: rgba(64, 158, 255, 0.16);
    text-decoration: underline;
  }
}

// 按钮
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.16s;
  white-space: nowrap;

  &:hover {
    border-color: #c6d4e6;
    background: #f7faff;
    color: #409eff;
  }

  &.primary {
    background: linear-gradient(135deg, #409eff, #5b7cff);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.25);

    &:hover { filter: brightness(1.06); }
    &:disabled { background: #c8d6ea; cursor: not-allowed; box-shadow: none; filter: none; }
  }

  &.ghost { background: #f5f7fa; border-color: #e4e7ed; }
  &.sm { min-height: 28px; padding: 0 10px; font-size: 12px; border-radius: 7px; }
  .icon { font-size: 12px; }
}

.spacer {
  flex: 1 1 auto;
}

// ==================== 168px 模型标签流 ====================
.models-head-lbl {
  justify-content: space-between;
  .lbl-left, .lbl-right {
    display: flex;
    align-items: center;
    gap: 7px;
  }
}

.chips-container-168 {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-content: flex-start;
  align-items: center;
  height: 168px; // 固定 5 行高
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.16s;
  cursor: text;
  overflow-y: auto;
  overflow-x: hidden;

  &:focus-within {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
  }
}

.chips-container-92 {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-content: flex-start;
  align-items: center;
  height: 92px;
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  cursor: text;
  overflow-y: auto;
  overflow-x: hidden;

  &:focus-within {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
  }
}

.chip-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 5px 1px 9px;
  border-radius: 7px;
  background: #f2f7ff;
  border: 1px solid #d9ecff;
  color: #2f6bd8;
  font-size: 12.2px;
  line-height: 1.8;
  max-width: 100%;

  .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 210px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .remove-btn {
    cursor: pointer;
    color: #9db8dc;
    font-size: 12px;
    padding: 0 3px;
    border-radius: 4px;
    line-height: 1.4;

    &:hover {
      color: #f56c6c;
      background: #fff;
    }
  }

}

.chip-inline-input {
  flex: 1 1 140px;
  min-width: 140px;
  border: 0;
  outline: 0;
  height: 28px;
  font-size: 13px;
  font-family: inherit;
  background: transparent;
  color: #303133;
}

.chipbar-footer {
  display: flex;
  align-items: center;
  margin-top: 7px;
  flex-wrap: wrap;
  gap: 8px;
}

// ==================== 可折叠模块化卡片 (模型 / 游客 / 高级) ====================
.modular-details {
  margin-top: 18px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fdfdfe;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: #dcdfe6;
  }

  &[open] {
    border-color: #dce5f0;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);

    > .modular-summary {
      border-bottom: 1px solid #f0f2f5;

      &::before {
        transform: rotate(90deg);
        color: #409eff;
      }
    }
  }

  &.model-details {
    margin-top: 22px;
    border-color: #dce5f0;
  }
}

.modular-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fafbfc;
  cursor: pointer;
  user-select: none;
  transition: background 0.16s;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::before {
    content: '›';
    font-size: 18px;
    line-height: 1;
    color: #909399;
    margin-right: 10px;
    transition: transform 0.2s, color 0.2s;
    font-weight: 700;
  }

  &:hover {
    background: #f4f6fa;
  }

  .summary-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    .mod-title {
      font-size: 13.5px;
      font-weight: 600;
      color: #303133;
    }
  }

  .summary-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .summary-meta {
      font-size: 12px;
      color: #909399;
    }
  }
}

.modular-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// 游客模型权限字段与导入面板
.sub-field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .sub-lbl-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .quick-batch-btns {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;

      .link-btn {
        border: 0;
        background: transparent;
        color: #409eff;
        cursor: pointer;
        font-size: 12px;
        padding: 0 2px;
        font-family: inherit;

        &:hover { text-decoration: underline; }
        &.danger {
          color: #f56c6c;
        }
      }

      .divider {
        color: #dcdfe6;
      }
    }
  }
}

// 辅助导入面板
.guest-import-panel {
  background: #f4f6fa;
  border: 1px dashed #dcdfe6;
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 2px;

  .import-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 8px;

    .panel-tit {
      font-size: 12px;
      font-weight: 600;
      color: #606266;
    }

    .import-search-box {
      display: flex;
      align-items: center;
      gap: 8px;

      .import-input {
        height: 28px;
        padding: 0 8px;
        border: 1px solid #dcdfe6;
        border-radius: 6px;
        font-size: 12px;
        outline: 0;
        width: 200px;
        background: #fff;
        font-family: inherit;

        &:focus { border-color: #409eff; }
      }
    }
  }

  .candidates-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 120px;
    overflow-y: auto;
  }
}

.combo-select-box {
  border: 1px solid #dcdfe6;
  border-radius: 9px;
  background: #fff;
  padding: 8px;
  transition: border-color 0.16s;

  &:focus-within {
    border-color: #409eff;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);
  }

  .combo-top {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 2px 7px;
    border-bottom: 1px dashed #eef0f3;
    margin-bottom: 7px;

    .ci {
      font-size: 11.5px;
      color: #a8abb2;
      background: #f4f6f9;
      border: 1px solid #eef0f3;
      border-radius: 6px;
      padding: 0 6px;
      line-height: 1.7;
    }

    input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      outline: 0;
      font-size: 12.8px;
      font-family: inherit;
      background: transparent;
      color: #303133;
      height: 26px;
    }
  }
}

.cand-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 7px;
  border: 1px dashed #dcdfe6;
  background: #fff;
  color: #606266;
  font-size: 12px;
  font-family: ui-monospace, Menlo, monospace;
  cursor: pointer;
  transition: all 0.14s;

  &:hover {
    border-color: #b3d8ff;
    color: #409eff;
    background: #f7faff;
  }

  &.on {
    border-style: solid;
    border-color: #d7efc4;
    background: #f0f9eb;
    color: #3f7a22;
    font-weight: 600;
  }

  .pill-check {
    font-size: 11px;
    opacity: 0.8;
  }
}

// 高级设置内部块
.adv-details {
  .adv-sub-block {
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid #eef0f3;

    .adv-block-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 10px;
    }

    :deep(.dynamic-form) {
      .settings-group {
        margin-bottom: 10px;
      }
      .group-title {
        font-size: 12px;
        font-weight: 600;
        color: #606266;
        margin-bottom: 4px;
      }
      .settings-card {
        background: #fff;
        border: 1px solid #eef0f3;
        border-radius: 8px;
        padding: 8px 12px;
      }
      .setting-field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px dashed #f0f2f5;

        &:last-child {
          border-bottom: none;
        }

        .field-label {
          font-size: 12.5px;
          color: #4b5563;
        }
      }
    }
  }

  .enable-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .reauth-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
}

// 底部状态栏与按钮
.dialog-footer-v4 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid #eef0f3;
  background: #fbfcfe;
  border-radius: 0 0 16px 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.statuses-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 240px;

  .st-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: #a0a6b0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .st-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #dcdfe6;
      flex-shrink: 0;
    }

    &.run {
      color: #409eff;
      .st-dot { background: #409eff; animation: st-blink 1s ease infinite; }
    }
    &.ok {
      color: #529b2e;
      .st-dot { background: #67c23a; }
    }
    &.warn {
      color: #e6a23c;
      .st-dot { background: #e6a23c; }
    }
    &.bad {
      color: #c45656;
      .st-dot { background: #f56c6c; }
    }
  }
}

@keyframes st-blink {
  50% { opacity: 0.25; }
}

.actions-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.save-disabled-reason {
  max-width: 220px;
  color: #e6a23c;
  font-size: 11.5px;
  line-height: 1.35;
  text-align: right;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  &.g { background: #67c23a; }
  &.y { background: #e6a23c; }
}

.spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #d9ecff;
  border-top-color: #409eff;
  animation: rot 0.7s linear infinite;
  display: inline-block;
}

@keyframes rot {
  to { transform: rotate(360deg); }
}

// 暗色主题：编辑器内部是原生控件，不能只依赖 Element Plus 的暗色变量。
:global([data-theme="dark"] .v4-editor-dialog),
:global(html.dark .v4-editor-dialog) {
  background: var(--mio-bg-surface, #1e1e24);
  color: var(--mio-text-primary, #fff);

  .dialog-scroll-body {
    background: var(--mio-bg-surface, #1e1e24);
    color: var(--mio-text-primary, #fff);
  }

  .field-lbl,
  .sub-lbl,
  .input-wrap input,
  .native-select,
  .chip-inline-input,
  .ta-json,
  .sa-summary,
  .pd-trigger .txt,
  .pd-item .nm {
    color: var(--mio-text-primary, #fff);
  }

  .input-wrap,
  .native-select,
  .ta-json,
  .pd-trigger,
  .pd-panel,
  .pd-panel .srch input,
  .cred-card,
  .oauth-card,
  .sa-summary,
  .chips-container-168,
  .chips-container-92,
  .modular-details {
    background: var(--mio-bg-surface-soft, #18181b);
    border-color: var(--mio-border-color-light, #3a3a42);
  }

  .input-wrap.locked,
  .cred-card,
  .modular-details {
    background: var(--mio-bg-card, #2f2f2f);
  }

  .pd-trigger:hover,
  .pd-item:hover,
  .btn:hover {
    background: var(--mio-bg-hover, #2f2f2f);
  }

  .pd-panel {
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.5);
  }

  .pd-group-title,
  .pd-panel .url,
  .hint-txt,
  .pd-trigger .caret,
  .field-lbl .tag-badge.gray,
  .btn {
    color: var(--mio-text-secondary, #acacac);
  }

  .tag-badge.gray,
  .btn.ghost {
    background: var(--mio-bg-info-light, rgba(144, 147, 153, 0.15));
    border-color: var(--mio-border-color-light, #3a3a42);
  }

  .pd-trigger.open,
  .input-wrap:focus-within,
  .native-select:focus,
  .ta-json:focus,
  .chips-container-168:focus-within,
  .chips-container-92:focus-within {
    border-color: var(--el-color-primary, #409eff);
  }

  .dialog-footer-v4 {
    background: var(--mio-bg-surface-soft, #18181b);
    border-color: var(--mio-border-color-light, #3a3a42);
  }
}

// 补齐编辑器内部自定义表单控件与 Element Plus 弹窗的暗色层次。
:global([data-theme="dark"] .v4-editor-dialog),
:global(html.dark .v4-editor-dialog) {
  :deep(.el-dialog__header) {
    background: #25252b;
    border-bottom: 1px solid #41414b;
  }

  :deep(.el-dialog__title) {
    color: #f5f5f7;
  }

  :deep(.el-dialog__headerbtn .el-dialog__close) {
    color: #a7a7b2;
  }

  :deep(.el-dialog__headerbtn:hover .el-dialog__close) {
    color: #66b5ff;
  }

  :deep(.el-dialog__body) {
    background: #1e1e24;
  }

  .field-lbl,
  .sub-lbl,
  .mod-title,
  .panel-tit,
  .adv-block-title,
  .summary-meta,
  .field-lbl .lbl-left,
  .field-lbl .lbl-right {
    color: #f1f1f4;
  }

  .field-box,
  .proto-info-row,
  .hint-txt,
  .hint-txt.proto-desc,
  .chipbar-footer,
  .summary-meta {
    color: #a8a8b3;
  }

  .hint-txt.warn,
  .hint-txt.bad {
    color: #f0a6a6;
  }

  .input-wrap,
  .native-select,
  .ta-json,
  .combo-select-box,
  .chips-container-168,
  .chips-container-92,
  .pd-trigger,
  .pd-panel,
  .guest-import-panel,
  .oauth-card,
  .cred-card,
  .modular-details,
  .settings-card {
    background: #25252b;
    border-color: #464650;
    color: #f1f1f4;
  }

  .input-wrap input,
  .native-select,
  .ta-json,
  .chip-inline-input,
  .combo-top input,
  .import-input,
  .pd-panel .srch input {
    background: transparent;
    color: #f1f1f4;
    caret-color: #66b5ff;
  }

  .input-wrap input::placeholder,
  .ta-json::placeholder,
  .chip-inline-input::placeholder,
  .combo-top input::placeholder,
  .import-input::placeholder,
  .pd-panel .srch input::placeholder {
    color: #777783;
  }

  .input-wrap.locked {
    background: #303039;
    border-color: #51515d;
  }

  .input-wrap:focus-within,
  .native-select:focus,
  .ta-json:focus,
  .combo-select-box:focus-within,
  .chips-container-168:focus-within,
  .chips-container-92:focus-within,
  .pd-panel .srch input:focus,
  .import-input:focus {
    border-color: #4aa8ff;
    box-shadow: 0 0 0 3px rgba(74, 168, 255, 0.16);
  }

  .native-select,
  .native-select option {
    color-scheme: dark;
    background-color: #25252b;
    color: #f1f1f4;
  }

  .addon-btn {
    color: #8fc8ff;
    border-left-color: #464650;
  }

  .pd-trigger:hover,
  .pd-item:hover,
  .modular-summary:hover,
  .cand-pill:hover,
  .btn:hover {
    background: #303039;
  }

  .pd-trigger.open {
    border-color: #4aa8ff;
    box-shadow: 0 0 0 3px rgba(74, 168, 255, 0.14);
  }

  .pd-panel {
    background: #25252b;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
  }

  .pd-panel .srch input {
    background: #1e1e24;
    border-color: #464650;
  }

  .pd-group-title,
  .pd-panel .url,
  .pd-trigger .caret,
  .empty-hint,
  .hint-txt,
  .summary-meta,
  .sa-summary .k,
  .sub-lbl {
    color: #92929e;
  }

  .pd-trigger .txt,
  .pd-item .nm,
  .combo-top input,
  .mod-title,
  .adv-block-title,
  .setting-field .field-label {
    color: #f1f1f4;
  }

  .pd-trigger .txt.ph {
    color: #858591;
  }

  .tag-badge.gray,
  .btn.ghost,
  .combo-top .ci {
    background: rgba(144, 147, 153, 0.16);
    border-color: #464650;
    color: #b4b4be;
  }

  .tag-badge.blue {
    background: rgba(64, 158, 255, 0.16);
    border-color: rgba(74, 168, 255, 0.42);
    color: #8fc8ff;
  }

  .tag-badge.purple {
    background: rgba(107, 78, 230, 0.2);
    border-color: rgba(145, 124, 255, 0.42);
    color: #c1b5ff;
  }

  .tag-badge.green {
    background: rgba(103, 194, 58, 0.16);
    border-color: rgba(103, 194, 58, 0.4);
    color: #a6df8e;
  }

  .cred-card,
  .oauth-card,
  .guest-import-panel,
  .adc-env-box,
  .adc-json-box {
    background: #292930;
  }

  .sa-summary {
    background: #202027;
    border-color: #464650;
    color: #c5c5cd;

    &.ok {
      background: rgba(103, 194, 58, 0.11);
      border-color: rgba(103, 194, 58, 0.42);
    }

    &.bad {
      background: rgba(245, 108, 108, 0.11);
      border-color: rgba(245, 108, 108, 0.42);
      color: #f0a6a6;
    }
  }

  .usercode {
    background: rgba(64, 158, 255, 0.16);
    border-color: rgba(74, 168, 255, 0.42);
    color: #8fc8ff;
  }

  .btn {
    background: #303039;
    border-color: #51515d;
    color: #d0d0d8;

    &.ghost {
      background: rgba(144, 147, 153, 0.12);
    }

    &:disabled {
      background: #292930;
      border-color: #3b3b44;
      color: #666672;
    }
  }

  .chips-container-168,
  .chips-container-92 {
    background: #202027;
  }

  .chip-item {
    background: rgba(64, 158, 255, 0.16);
    border-color: rgba(64, 158, 255, 0.35);
    color: #79bbff;

    .nm {
      color: #a0cfff;
    }

    .remove-btn {
      color: #79bbff;

      &:hover {
        color: #f56c6c;
        background: rgba(245, 108, 108, 0.22);
      }
    }
  }

  .modular-details {
    background: #25252b;

    &[open] {
      background: #292930;
      border-color: #51515d;

      > .modular-summary {
        border-bottom-color: #41414b;
      }
    }
  }

  .modular-summary {
    background: #25252b;

    &:hover {
      background: #303039;
    }
  }

  .modular-content {
    background: #292930;
  }

  .adv-sub-block,
  .sub-field-row,
  .combo-top {
    border-color: #41414b;
  }

  .import-input,
  .cand-pill {
    background: #202027;
    border-color: #464650;
    color: #d4d4dc;
  }

  .cand-pill.on {
    background: rgba(103, 194, 58, 0.14);
    border-color: rgba(103, 194, 58, 0.4);
    color: #b5e69f;
  }

  .dialog-footer-v4 {
    background: #25252b;
    border-top-color: #41414b;
  }
}

// Teleport + scoped CSS 兼容：所有关键控件都使用完整选择器，避免暗色规则被压缩成只匹配 html。
:global([data-theme="dark"] .v4-editor-dialog),
:global(html.dark .v4-editor-dialog) {
  background: #1e1e24 !important;
  color: #f1f1f4 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .el-dialog__header),
:global(html.dark .v4-editor-dialog .el-dialog__header) {
  background: #25252b !important;
  border-bottom: 1px solid #41414b !important;
}

:global([data-theme="dark"] .v4-editor-dialog .el-dialog__title),
:global(html.dark .v4-editor-dialog .el-dialog__title),
:global([data-theme="dark"] .v4-editor-dialog .field-lbl),
:global(html.dark .v4-editor-dialog .field-lbl),
:global([data-theme="dark"] .v4-editor-dialog .sub-lbl),
:global(html.dark .v4-editor-dialog .sub-lbl),
:global([data-theme="dark"] .v4-editor-dialog .mod-title),
:global(html.dark .v4-editor-dialog .mod-title),
:global([data-theme="dark"] .v4-editor-dialog .adv-block-title),
:global(html.dark .v4-editor-dialog .adv-block-title) {
  color: #f1f1f4 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .el-dialog__body),
:global(html.dark .v4-editor-dialog .el-dialog__body),
:global([data-theme="dark"] .v4-editor-dialog .dialog-scroll-body),
:global(html.dark .v4-editor-dialog .dialog-scroll-body) {
  background: #1e1e24 !important;
  color: #f1f1f4 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .hint-txt),
:global(html.dark .v4-editor-dialog .hint-txt),
:global([data-theme="dark"] .v4-editor-dialog .summary-meta),
:global(html.dark .v4-editor-dialog .summary-meta),
:global([data-theme="dark"] .v4-editor-dialog .pd-group-title),
:global(html.dark .v4-editor-dialog .pd-group-title),
:global([data-theme="dark"] .v4-editor-dialog .pd-panel .url),
:global(html.dark .v4-editor-dialog .pd-panel .url) {
  color: #92929e !important;
}

:global([data-theme="dark"] .v4-editor-dialog .pd-trigger .txt),
:global(html.dark .v4-editor-dialog .pd-trigger .txt),
:global([data-theme="dark"] .v4-editor-dialog .pd-item .nm),
:global(html.dark .v4-editor-dialog .pd-item .nm) {
  color: #f1f1f4 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .pd-trigger .txt.ph),
:global(html.dark .v4-editor-dialog .pd-trigger .txt.ph),
:global([data-theme="dark"] .v4-editor-dialog .pd-trigger .caret),
:global(html.dark .v4-editor-dialog .pd-trigger .caret) {
  color: #92929e !important;
}

:global([data-theme="dark"] .v4-editor-dialog .input-wrap),
:global(html.dark .v4-editor-dialog .input-wrap),
:global([data-theme="dark"] .v4-editor-dialog .native-select),
:global(html.dark .v4-editor-dialog .native-select),
:global([data-theme="dark"] .v4-editor-dialog .ta-json),
:global(html.dark .v4-editor-dialog .ta-json),
:global([data-theme="dark"] .v4-editor-dialog .pd-trigger),
:global(html.dark .v4-editor-dialog .pd-trigger),
:global([data-theme="dark"] .v4-editor-dialog .combo-select-box),
:global(html.dark .v4-editor-dialog .combo-select-box),
:global([data-theme="dark"] .v4-editor-dialog .chips-container-168),
:global(html.dark .v4-editor-dialog .chips-container-168),
:global([data-theme="dark"] .v4-editor-dialog .chips-container-92),
:global(html.dark .v4-editor-dialog .chips-container-92),
:global([data-theme="dark"] .v4-editor-dialog .pd-panel),
:global(html.dark .v4-editor-dialog .pd-panel),
:global([data-theme="dark"] .v4-editor-dialog .cred-card),
:global(html.dark .v4-editor-dialog .cred-card),
:global([data-theme="dark"] .v4-editor-dialog .oauth-card),
:global(html.dark .v4-editor-dialog .oauth-card),
:global([data-theme="dark"] .v4-editor-dialog .guest-import-panel),
:global(html.dark .v4-editor-dialog .guest-import-panel),
:global([data-theme="dark"] .v4-editor-dialog .modular-details),
:global(html.dark .v4-editor-dialog .modular-details) {
  background: #25252b !important;
  border-color: #464650 !important;
  color: #f1f1f4 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .input-wrap input),
:global(html.dark .v4-editor-dialog .input-wrap input),
:global([data-theme="dark"] .v4-editor-dialog .native-select),
:global(html.dark .v4-editor-dialog .native-select),
:global([data-theme="dark"] .v4-editor-dialog .ta-json),
:global(html.dark .v4-editor-dialog .ta-json),
:global([data-theme="dark"] .v4-editor-dialog .chip-inline-input),
:global(html.dark .v4-editor-dialog .chip-inline-input),
:global([data-theme="dark"] .v4-editor-dialog .combo-top input),
:global(html.dark .v4-editor-dialog .combo-top input),
:global([data-theme="dark"] .v4-editor-dialog .import-input),
:global(html.dark .v4-editor-dialog .import-input),
:global([data-theme="dark"] .v4-editor-dialog .pd-panel .srch input),
:global(html.dark .v4-editor-dialog .pd-panel .srch input) {
  background: transparent !important;
  color: #f1f1f4 !important;
  caret-color: #66b5ff !important;
}

:global([data-theme="dark"] .v4-editor-dialog input::placeholder),
:global(html.dark .v4-editor-dialog input::placeholder),
:global([data-theme="dark"] .v4-editor-dialog textarea::placeholder),
:global(html.dark .v4-editor-dialog textarea::placeholder) {
  color: #777783 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .input-wrap.locked),
:global(html.dark .v4-editor-dialog .input-wrap.locked) {
  background: #303039 !important;
  border-color: #51515d !important;
}

:global([data-theme="dark"] .v4-editor-dialog .native-select),
:global(html.dark .v4-editor-dialog .native-select),
:global([data-theme="dark"] .v4-editor-dialog .native-select option),
:global(html.dark .v4-editor-dialog .native-select option) {
  color-scheme: dark;
  background-color: #25252b !important;
  color: #f1f1f4 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .pd-panel .srch input),
:global(html.dark .v4-editor-dialog .pd-panel .srch input),
:global([data-theme="dark"] .v4-editor-dialog .import-input),
:global(html.dark .v4-editor-dialog .import-input) {
  background: #202027 !important;
  border-color: #464650 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .input-wrap:focus-within),
:global(html.dark .v4-editor-dialog .input-wrap:focus-within),
:global([data-theme="dark"] .v4-editor-dialog .native-select:focus),
:global(html.dark .v4-editor-dialog .native-select:focus),
:global([data-theme="dark"] .v4-editor-dialog .ta-json:focus),
:global(html.dark .v4-editor-dialog .ta-json:focus),
:global([data-theme="dark"] .v4-editor-dialog .combo-select-box:focus-within),
:global(html.dark .v4-editor-dialog .combo-select-box:focus-within),
:global([data-theme="dark"] .v4-editor-dialog .chips-container-168:focus-within),
:global(html.dark .v4-editor-dialog .chips-container-168:focus-within),
:global([data-theme="dark"] .v4-editor-dialog .chips-container-92:focus-within),
:global(html.dark .v4-editor-dialog .chips-container-92:focus-within) {
  border-color: #4aa8ff !important;
  box-shadow: 0 0 0 3px rgba(74, 168, 255, 0.16) !important;
}

:global([data-theme="dark"] .v4-editor-dialog .pd-trigger:hover),
:global(html.dark .v4-editor-dialog .pd-trigger:hover),
:global([data-theme="dark"] .v4-editor-dialog .pd-item:hover),
:global(html.dark .v4-editor-dialog .pd-item:hover),
:global([data-theme="dark"] .v4-editor-dialog .modular-summary:hover),
:global(html.dark .v4-editor-dialog .modular-summary:hover),
:global([data-theme="dark"] .v4-editor-dialog .btn:hover),
:global(html.dark .v4-editor-dialog .btn:hover) {
  background: #303039 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .pd-trigger.open),
:global(html.dark .v4-editor-dialog .pd-trigger.open) {
  border-color: #4aa8ff !important;
  box-shadow: 0 0 0 3px rgba(74, 168, 255, 0.14) !important;
}

:global([data-theme="dark"] .v4-editor-dialog .modular-summary),
:global(html.dark .v4-editor-dialog .modular-summary),
:global([data-theme="dark"] .v4-editor-dialog .modular-content),
:global(html.dark .v4-editor-dialog .modular-content) {
  background: #292930 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .modular-details[open]),
:global(html.dark .v4-editor-dialog .modular-details[open]) {
  background: #292930 !important;
  border-color: #51515d !important;
}

:global([data-theme="dark"] .v4-editor-dialog .modular-details[open] > .modular-summary),
:global(html.dark .v4-editor-dialog .modular-details[open] > .modular-summary) {
  border-bottom-color: #41414b !important;
}

:global([data-theme="dark"] .v4-editor-dialog .chips-container-168),
:global(html.dark .v4-editor-dialog .chips-container-168),
:global([data-theme="dark"] .v4-editor-dialog .chips-container-92),
:global(html.dark .v4-editor-dialog .chips-container-92) {
  background: #202027 !important;
}

:global([data-theme="dark"] .v4-editor-dialog .tag-badge.gray),
:global(html.dark .v4-editor-dialog .tag-badge.gray),
:global([data-theme="dark"] .v4-editor-dialog .btn.ghost),
:global(html.dark .v4-editor-dialog .btn.ghost) {
  background: rgba(144, 147, 153, 0.16) !important;
  border-color: #464650 !important;
  color: #b4b4be !important;
}

:global([data-theme="dark"] .v4-editor-dialog .tag-badge.blue),
:global(html.dark .v4-editor-dialog .tag-badge.blue) {
  background: rgba(64, 158, 255, 0.16) !important;
  border-color: rgba(74, 168, 255, 0.42) !important;
  color: #8fc8ff !important;
}

:global([data-theme="dark"] .v4-editor-dialog .tag-badge.purple),
:global(html.dark .v4-editor-dialog .tag-badge.purple) {
  background: rgba(107, 78, 230, 0.2) !important;
  border-color: rgba(145, 124, 255, 0.42) !important;
  color: #c1b5ff !important;
}

:global([data-theme="dark"] .v4-editor-dialog .tag-badge.green),
:global(html.dark .v4-editor-dialog .tag-badge.green) {
  background: rgba(103, 194, 58, 0.16) !important;
  border-color: rgba(103, 194, 58, 0.4) !important;
  color: #a6df8e !important;
}

:global([data-theme="dark"] .v4-editor-dialog .sa-summary),
:global(html.dark .v4-editor-dialog .sa-summary),
:global([data-theme="dark"] .v4-editor-dialog .dialog-footer-v4),
:global(html.dark .v4-editor-dialog .dialog-footer-v4) {
  background: #25252b !important;
  border-color: #41414b !important;
}
</style>
