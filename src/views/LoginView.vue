<script setup lang="ts">
import { ArrowRight, Wallet, Lock } from "@element-plus/icons-vue";
import { useLedger } from "../composables/useLedger";
const { loginKey, loggingIn, loading, login } = useLedger();
</script>

<template>
  <main class="login-screen">
    <section class="login-story">
      <div class="brand">
        <span class="brand-symbol"
          ><el-icon><Wallet /></el-icon></span
        ><span>卡有数<span class="brand-en">CARD TALLY</span></span>
      </div>
      <div>
        <span class="eyebrow">每一笔，都心中有数</span>
        <h1>多张信用卡，<br />一本明白账。</h1>
        <p>随手记录日常消费，把每个月的支出<br />看得更清楚一点。</p>
        <div class="story-tags">
          <span>手机随手记</span><span>月度看全局</span><span>数据自己存</span>
        </div>
      </div>
      <small>私人账本 · SQLite 本地存储</small>
    </section>
    <section class="login-panel">
      <div class="login-box">
        <span class="login-lock"
          ><el-icon><Lock /></el-icon
        ></span>
        <h2>打开你的账本</h2>
        <p>输入服务端生成的访问密钥，连接同一个账本。</p>
        <el-form @submit.prevent="login"
          ><el-form-item label="访问密钥" label-position="top"
            ><el-input
              v-model="loginKey"
              type="password"
              show-password
              placeholder="粘贴访问密钥"
              size="large"
              autocomplete="current-password" /></el-form-item
          ><el-button
            type="primary"
            size="large"
            native-type="submit"
            :loading="loggingIn"
            class="full-width"
            >进入账本 <el-icon><ArrowRight /></el-icon></el-button
        ></el-form>
        <div class="login-hint">
          首次使用？在项目
          <code>data/access-key.txt</code>
          文件中获取密钥。密钥仅保存在本标签页会话中。
        </div>
      </div>
    </section>
  </main>
</template>
