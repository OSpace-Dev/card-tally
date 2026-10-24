import { createRouter, createWebHistory } from "vue-router";
import AppLayout from "./layouts/AppLayout.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: AppLayout,
      children: [
        { path: "", redirect: "/overview" },
        {
          path: "overview",
          name: "overview",
          component: () => import("./views/OverviewView.vue"),
        },
        {
          path: "card-statistics",
          name: "card-statistics",
          component: () => import("./views/CardStatisticsView.vue"),
        },
        {
          path: "card-statistics/:cardId/months",
          name: "card-month-details",
          component: () => import("./views/CardMonthDetailsView.vue"),
        },
        {
          path: "records",
          name: "records",
          component: () => import("./views/RecordsView.vue"),
        },
        {
          path: "cards",
          name: "cards",
          component: () => import("./views/CardsView.vue"),
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/overview" },
  ],
});
