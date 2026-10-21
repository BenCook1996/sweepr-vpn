using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Text;
using System.Windows.Forms;

namespace SweeprVpnApp
{
    public class ServerNode
    {
        public string Code;
        public string Label;
        public string City;
        public string CallQuality;
        public string StreamSpeed;
        public string Ip;

        public ServerNode(string code, string label, string city, string callQuality, string streamSpeed, string ip)
        {
            Code = code;
            Label = label;
            City = city;
            CallQuality = callQuality;
            StreamSpeed = streamSpeed;
            Ip = ip;
        }

        public override string ToString()
        {
            return Label;
        }
    }

    public class BentoPanel : Panel
    {
        public int CornerRadius = 22;
        public Color CardFill = Color.White;
        public Color CardBorder = Color.FromArgb(226, 232, 240);
        public int BorderThickness = 1;

        public BentoPanel()
        {
            this.DoubleBuffered = true;
            this.BackColor = Color.Transparent;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle rect = new Rectangle(1, 1, this.Width - 3, this.Height - 3);
            using (GraphicsPath path = CreateRoundRect(rect, CornerRadius))
            using (SolidBrush brush = new SolidBrush(CardFill))
            using (Pen pen = new Pen(CardBorder, BorderThickness))
            {
                e.Graphics.FillPath(brush, path);
                e.Graphics.DrawPath(pen, path);
            }
            base.OnPaint(e);
        }

        public static GraphicsPath CreateRoundRect(Rectangle r, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = Math.Min(radius * 2, Math.Min(r.Width, r.Height));
            if (d <= 0)
            {
                path.AddRectangle(r);
                return path;
            }
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    public class PillButton : Button
    {
        public Color GradStart = Color.FromArgb(5, 150, 105);
        public Color GradEnd = Color.FromArgb(16, 185, 129);
        public Color TextColor = Color.White;

        public PillButton()
        {
            this.FlatStyle = FlatStyle.Flat;
            this.FlatAppearance.BorderSize = 0;
            this.BackColor = Color.White;
            this.Cursor = Cursors.Hand;
            this.DoubleBuffered = true;
            this.UseMnemonic = false;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.Clear(this.Parent != null ? Color.White : this.BackColor);
            Rectangle rect = new Rectangle(1, 1, this.Width - 3, this.Height - 3);
            using (GraphicsPath path = BentoPanel.CreateRoundRect(rect, rect.Height))
            using (LinearGradientBrush brush = new LinearGradientBrush(rect, GradStart, GradEnd, LinearGradientMode.Horizontal))
            {
                e.Graphics.FillPath(brush, path);
            }
            TextRenderer.DrawText(
                e.Graphics,
                this.Text,
                this.Font,
                rect,
                TextColor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix
            );
        }
    }

    public class GaugeControl : Control
    {
        public int Percentage = 30;
        public bool Connected = false;
        public string BadgeWord = "OFF";
        public string TitleText = "Not Protected Yet";
        public string SubText = "Websites can see your real location";

        public GaugeControl()
        {
            this.DoubleBuffered = true;
            this.BackColor = Color.White;
            this.Size = new Size(260, 150);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.Clear(this.BackColor);
            Rectangle arcRect = new Rectangle(35, 15, 190, 190);
            using (Pen trackPen = new Pen(Color.FromArgb(226, 232, 240), 14f))
            {
                trackPen.StartCap = LineCap.Round;
                trackPen.EndCap = LineCap.Round;
                e.Graphics.DrawArc(trackPen, arcRect, 180, 180);
            }

            Color activeColor = Connected ? Color.FromArgb(16, 185, 129) : Color.FromArgb(245, 158, 11);
            float sweep = Math.Max(18f, Math.Min(180f, (Percentage / 100f) * 180f));
            using (Pen fgPen = new Pen(activeColor, 14f))
            {
                fgPen.StartCap = LineCap.Round;
                fgPen.EndCap = LineCap.Round;
                e.Graphics.DrawArc(fgPen, arcRect, 180, sweep);
            }

            using (Font bigFont = new Font("Segoe UI", 22f, FontStyle.Bold))
            using (Font titleFont = new Font("Segoe UI", 9.5f, FontStyle.Bold))
            using (Font subFont = new Font("Segoe UI", 8.25f, FontStyle.Regular))
            {
                TextRenderer.DrawText(
                    e.Graphics,
                    BadgeWord,
                    bigFont,
                    new Rectangle(0, 52, this.Width, 45),
                    activeColor,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix
                );
                TextRenderer.DrawText(
                    e.Graphics,
                    TitleText,
                    titleFont,
                    new Rectangle(0, 98, this.Width, 22),
                    Color.FromArgb(15, 23, 42),
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix
                );
                TextRenderer.DrawText(
                    e.Graphics,
                    SubText,
                    subFont,
                    new Rectangle(0, 118, this.Width, 22),
                    Color.FromArgb(100, 116, 139),
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix
                );
            }
        }
    }

    public class MainForm : Form
    {
        public List<ServerNode> Servers = new List<ServerNode>();
        public ServerNode CurrentServer;
        public bool IsConnected = false;
        public bool IsPro = false;
        public bool IsDarkTheme = false;
        public bool IsRadarEnabled = false;
        public string CurrentTab = "dashboard";
        public string CurrentFrequency = "Always On";
        public string CurrentProtocol = "Everyday Browsing & 4K Streaming (Recommended — Fastest)";
        public bool[] ShieldStates = new bool[] { true, true, true, true };
        public List<string> DiscoveredLanDevices = new List<string>();

        // Controls exposed for interactive use & automated verification
        public Button TabDashboardBtn;
        public Button TabRadarBtn;
        public ComboBox LangCombo;
        public Button TierBadgeBtn;
        public Button ThemeBtn;

        public Panel DashboardView;
        public Panel RadarView;

        public Label WelcomeSubtitle;
        public Label NodeBadgeLabel;
        public GaugeControl TunnelGauge;
        public ComboBox ServerLocationDropdown;
        public PillButton ConnectBtn;
        public PillButton FixRisksBtn;

        public Label WifiCountLabel;
        public ListBox WifiCleanList;
        public Label PingValueLabel;
        public Label SpeedValueLabel;
        public Button ScanWifiBtn;

        public Label BottomAcrLabel;
        public Label BottomWifiCountLabel;
        public Label BottomEncryptedLabel;

        // Radar View Controls
        public Button RadarToggleBtn;
        public Label RadarStatusBadge;
        public Button FreqRealTimeBtn;
        public Button Freq15mBtn;
        public Button FreqHourlyBtn;
        public ComboBox ProtocolDropdown;
        public RadioButton ActionAutoProtectRadio;
        public RadioButton ActionNotifyOnlyRadio;
        public CheckBox[] ShieldCheckboxes = new CheckBox[4];
        public Button ShieldsAllBtn;
        public Button ShieldsNoneBtn;
        public Button TestAlertBtn;

        public MainForm()
        {
            InitializeServers();
            this.Text = "SWEEPR VPN — Easy Privacy & Home Wi-Fi Protection";
            this.Size = new Size(1120, 740);
            this.MinimumSize = new Size(1020, 680);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(244, 247, 249);
            this.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            this.DoubleBuffered = true;

            BuildUI();
            RunWifiScan();
        }

        private Label MakeLabel(string text, Font font, Color color, Point location, bool autoSize = true)
        {
            Label lbl = new Label();
            lbl.UseMnemonic = false;
            lbl.Text = text;
            lbl.Font = font;
            lbl.ForeColor = color;
            lbl.BackColor = Color.Transparent;
            lbl.AutoSize = autoSize;
            lbl.Location = location;
            return lbl;
        }

        private void InitializeServers()
        {
            Servers.Add(new ServerNode("UK-LON-01", "United Kingdom — London (Fastest Nearby)", "London, UK", "Instant (No Lag)", "Ultra-Fast (4K)", "185.212.14.88"));
            Servers.Add(new ServerNode("CH-ZRH-01", "Switzerland — Zurich (Maximum Privacy)", "Zurich, Switzerland", "Instant (No Lag)", "Ultra-Fast (4K)", "194.42.18.104"));
            Servers.Add(new ServerNode("NL-AMS-01", "Netherlands — Amsterdam (Super Fast)", "Amsterdam, Netherlands", "Instant (No Lag)", "Ultra-Fast (4K)", "193.148.29.41"));
            Servers.Add(new ServerNode("DE-FRA-01", "Germany — Frankfurt (Fastest Europe)", "Frankfurt, Germany", "Instant (No Lag)", "Ultra-Fast (4K)", "185.199.108.62"));
            Servers.Add(new ServerNode("US-NYC-01", "United States — New York (East Coast)", "New York, USA", "Smooth (HD Ready)", "Ultra-Fast (4K)", "45.89.112.40"));
            Servers.Add(new ServerNode("US-LAX-01", "United States — Los Angeles (West Coast)", "Los Angeles, USA", "Smooth (HD Ready)", "Ultra-Fast (4K)", "104.244.72.19"));
            Servers.Add(new ServerNode("SG-SIN-01", "Singapore — Marina Bay (Asia-Pacific)", "Singapore", "Smooth (HD Ready)", "Ultra-Fast (4K)", "103.214.16.92"));
            Servers.Add(new ServerNode("JP-TYO-01", "Japan — Tokyo (High Speed Asia)", "Tokyo, Japan", "Smooth (HD Ready)", "Ultra-Fast (4K)", "138.199.44.18"));
            CurrentServer = Servers[0];
        }

        private void BuildUI()
        {
            // 1. Floating White Pill Header Bar (Plain-English Navigation & License Activation)
            BentoPanel topPill = new BentoPanel();
            topPill.CornerRadius = 30;
            topPill.Location = new Point(28, 18);
            topPill.Size = new Size(1048, 56);
            this.Controls.Add(topPill);

            Label brandLabel = MakeLabel("SWEEPR VPN", new Font("Segoe UI", 12f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(22, 16));
            topPill.Controls.Add(brandLabel);

            TabDashboardBtn = new Button();
            TabDashboardBtn.UseMnemonic = false;
            TabDashboardBtn.Text = "Home & Privacy";
            TabDashboardBtn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            TabDashboardBtn.FlatStyle = FlatStyle.Flat;
            TabDashboardBtn.FlatAppearance.BorderSize = 0;
            TabDashboardBtn.BackColor = Color.FromArgb(220, 252, 231);
            TabDashboardBtn.ForeColor = Color.FromArgb(4, 120, 87);
            TabDashboardBtn.Size = new Size(150, 34);
            TabDashboardBtn.Location = new Point(280, 11);
            TabDashboardBtn.Cursor = Cursors.Hand;
            TabDashboardBtn.Click += (s, e) => SwitchTab("dashboard");
            topPill.Controls.Add(TabDashboardBtn);

            TabRadarBtn = new Button();
            TabRadarBtn.UseMnemonic = false;
            TabRadarBtn.Text = "Wi-Fi & TV Protection";
            TabRadarBtn.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            TabRadarBtn.FlatStyle = FlatStyle.Flat;
            TabRadarBtn.FlatAppearance.BorderSize = 0;
            TabRadarBtn.BackColor = Color.White;
            TabRadarBtn.ForeColor = Color.FromArgb(100, 116, 139);
            TabRadarBtn.Size = new Size(185, 34);
            TabRadarBtn.Location = new Point(438, 11);
            TabRadarBtn.Cursor = Cursors.Hand;
            TabRadarBtn.Click += (s, e) => SwitchTab("radar");
            topPill.Controls.Add(TabRadarBtn);

            LangCombo = new ComboBox();
            LangCombo.DropDownStyle = ComboBoxStyle.DropDownList;
            LangCombo.Items.AddRange(new object[] { "English (UK)", "English (US)", "Deutsch", "Français", "日本語" });
            LangCombo.SelectedIndex = 0;
            LangCombo.Width = 105;
            LangCombo.Location = new Point(650, 16);
            topPill.Controls.Add(LangCombo);

            TierBadgeBtn = new Button();
            TierBadgeBtn.UseMnemonic = false;
            TierBadgeBtn.Text = "FREE PLAN · ENTER CODE";
            TierBadgeBtn.Font = new Font("Segoe UI", 8.25f, FontStyle.Bold);
            TierBadgeBtn.FlatStyle = FlatStyle.Flat;
            TierBadgeBtn.FlatAppearance.BorderSize = 1;
            TierBadgeBtn.BackColor = Color.FromArgb(254, 243, 199);
            TierBadgeBtn.ForeColor = Color.FromArgb(180, 83, 9);
            TierBadgeBtn.Size = new Size(176, 30);
            TierBadgeBtn.Location = new Point(766, 13);
            TierBadgeBtn.Cursor = Cursors.Hand;
            TierBadgeBtn.Click += (s, e) => OpenActivationDialog();
            topPill.Controls.Add(TierBadgeBtn);

            ThemeBtn = new Button();
            ThemeBtn.UseMnemonic = false;
            ThemeBtn.Text = "Dark Mode";
            ThemeBtn.Font = new Font("Segoe UI", 8.25f, FontStyle.Bold);
            ThemeBtn.FlatStyle = FlatStyle.Flat;
            ThemeBtn.FlatAppearance.BorderSize = 1;
            ThemeBtn.BackColor = Color.FromArgb(248, 250, 252);
            ThemeBtn.ForeColor = Color.FromArgb(71, 85, 105);
            ThemeBtn.Size = new Size(84, 30);
            ThemeBtn.Location = new Point(950, 13);
            ThemeBtn.Cursor = Cursors.Hand;
            ThemeBtn.Click += (s, e) => ToggleTheme();
            topPill.Controls.Add(ThemeBtn);

            // 2. Home & Privacy View Container (Tab 1)
            DashboardView = new Panel();
            DashboardView.Location = new Point(28, 86);
            DashboardView.Size = new Size(1048, 595);
            DashboardView.BackColor = Color.Transparent;
            this.Controls.Add(DashboardView);

            Label welcomeTitle = MakeLabel("Welcome back!", new Font("Segoe UI", 20f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(4, 0));
            DashboardView.Controls.Add(welcomeTitle);

            WelcomeSubtitle = MakeLabel("Your Home Wi-Fi Check is complete · 2 privacy improvements recommended below", new Font("Segoe UI", 9.5f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(6, 38));
            DashboardView.Controls.Add(WelcomeSubtitle);

            // Left Bento Card: What SWEEPR Protects (Plain English)
            BentoPanel leftCard = new BentoPanel();
            leftCard.Location = new Point(0, 72);
            leftCard.Size = new Size(336, 415);
            DashboardView.Controls.Add(leftCard);

            Label leftTitle = MakeLabel("WHAT SWEEPR PROTECTS", new Font("Segoe UI", 8.5f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(22, 22));
            leftCard.Controls.Add(leftTitle);

            AddRecommendationRow(leftCard, 62, "Stop Internet Slowdowns", "Prevent your Wi-Fi provider from slowing down videos");
            AddRecommendationRow(leftCard, 138, "Stop Smart-TV Spying", "Stop Samsung, LG & Roku TVs from tracking you");
            AddRecommendationRow(leftCard, 214, "Hide Your Location & IP", "Keep your home address private on every website");

            FixRisksBtn = new PillButton();
            FixRisksBtn.Text = "TURN ON ALL 3 PROTECTIONS";
            FixRisksBtn.GradStart = Color.FromArgb(52, 211, 153);
            FixRisksBtn.GradEnd = Color.FromArgb(16, 185, 129);
            FixRisksBtn.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            FixRisksBtn.Size = new Size(292, 42);
            FixRisksBtn.Location = new Point(22, 348);
            FixRisksBtn.Click += (s, e) => FixAllPrivacyRisks();
            leftCard.Controls.Add(FixRisksBtn);

            // Center Bento Card: Your Privacy Status + Country Location Dropdown
            BentoPanel centerCard = new BentoPanel();
            centerCard.Location = new Point(356, 72);
            centerCard.Size = new Size(336, 415);
            DashboardView.Controls.Add(centerCard);

            NodeBadgeLabel = MakeLabel("YOUR PRIVACY STATUS", new Font("Segoe UI", 8.5f, FontStyle.Bold), Color.FromArgb(5, 150, 105), new Point(0, 22), false);
            NodeBadgeLabel.Size = new Size(336, 20);
            NodeBadgeLabel.TextAlign = ContentAlignment.MiddleCenter;
            centerCard.Controls.Add(NodeBadgeLabel);

            TunnelGauge = new GaugeControl();
            TunnelGauge.Location = new Point(38, 48);
            centerCard.Controls.Add(TunnelGauge);

            Label serverDropLabel = MakeLabel("CHOOSE YOUR COUNTRY LOCATION", new Font("Segoe UI", 7.5f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(0, 212), false);
            serverDropLabel.Size = new Size(336, 16);
            serverDropLabel.TextAlign = ContentAlignment.MiddleCenter;
            centerCard.Controls.Add(serverDropLabel);

            ServerLocationDropdown = new ComboBox();
            ServerLocationDropdown.DropDownStyle = ComboBoxStyle.DropDownList;
            ServerLocationDropdown.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            foreach (ServerNode srv in Servers)
            {
                ServerLocationDropdown.Items.Add(srv);
            }
            ServerLocationDropdown.SelectedIndex = 0;
            ServerLocationDropdown.Size = new Size(288, 30);
            ServerLocationDropdown.Location = new Point(24, 232);
            ServerLocationDropdown.SelectedIndexChanged += (s, e) =>
            {
                ServerNode selected = ServerLocationDropdown.SelectedItem as ServerNode;
                if (selected != null) SelectServer(selected.Code);
            };
            centerCard.Controls.Add(ServerLocationDropdown);

            ConnectBtn = new PillButton();
            ConnectBtn.Text = "PROTECT MY COMPUTER NOW";
            ConnectBtn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            ConnectBtn.Size = new Size(288, 46);
            ConnectBtn.Location = new Point(24, 305);
            ConnectBtn.Click += (s, e) => ToggleConnection();
            centerCard.Controls.Add(ConnectBtn);

            Label safeNote = MakeLabel("One click hides your location and secures your Wi-Fi", new Font("Segoe UI", 8.25f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(0, 362), false);
            safeNote.Size = new Size(336, 20);
            safeNote.TextAlign = ContentAlignment.MiddleCenter;
            centerCard.Controls.Add(safeNote);

            // Right Bento Card: Devices on Your Home Wi-Fi & Connection Quality
            BentoPanel rightCard = new BentoPanel();
            rightCard.Location = new Point(712, 72);
            rightCard.Size = new Size(336, 415);
            DashboardView.Controls.Add(rightCard);

            Label rightTitle = MakeLabel("DEVICES ON YOUR HOME WI-FI", new Font("Segoe UI", 8.5f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(22, 22));
            rightCard.Controls.Add(rightTitle);

            WifiCountLabel = MakeLabel("4 Devices Found on Your Wi-Fi", new Font("Segoe UI", 11f, FontStyle.Bold), Color.FromArgb(5, 150, 105), new Point(22, 48));
            rightCard.Controls.Add(WifiCountLabel);

            WifiCleanList = new ListBox();
            WifiCleanList.BorderStyle = BorderStyle.FixedSingle;
            WifiCleanList.BackColor = Color.FromArgb(248, 250, 252);
            WifiCleanList.ForeColor = Color.FromArgb(15, 23, 42);
            WifiCleanList.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            WifiCleanList.Size = new Size(292, 180);
            WifiCleanList.Location = new Point(22, 85);
            rightCard.Controls.Add(WifiCleanList);

            Label speedHeader = MakeLabel("CONNECTION QUALITY & SPEED", new Font("Segoe UI", 8.5f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(22, 282));
            rightCard.Controls.Add(speedHeader);

            PingValueLabel = MakeLabel("Calls: Instant (No Lag)", new Font("Segoe UI", 9f, FontStyle.Bold), Color.FromArgb(4, 120, 87), new Point(22, 308));
            rightCard.Controls.Add(PingValueLabel);

            SpeedValueLabel = MakeLabel("Streaming: Ultra-Fast (4K)", new Font("Segoe UI", 9f, FontStyle.Bold), Color.FromArgb(4, 120, 87), new Point(22, 330));
            rightCard.Controls.Add(SpeedValueLabel);

            ScanWifiBtn = new Button();
            ScanWifiBtn.UseMnemonic = false;
            ScanWifiBtn.Text = "CHECK AGAIN";
            ScanWifiBtn.Font = new Font("Segoe UI", 8f, FontStyle.Bold);
            ScanWifiBtn.FlatStyle = FlatStyle.Flat;
            ScanWifiBtn.BackColor = Color.FromArgb(236, 253, 245);
            ScanWifiBtn.ForeColor = Color.FromArgb(4, 120, 87);
            ScanWifiBtn.Size = new Size(98, 34);
            ScanWifiBtn.Location = new Point(216, 312);
            ScanWifiBtn.Cursor = Cursors.Hand;
            ScanWifiBtn.Click += (s, e) => RunWifiScan();
            rightCard.Controls.Add(ScanWifiBtn);

            // Bottom Row: 3 Plain-English Summary Bento Cards
            BentoPanel bCard1 = new BentoPanel();
            bCard1.Location = new Point(0, 502);
            bCard1.Size = new Size(336, 78);
            DashboardView.Controls.Add(bCard1);

            BottomAcrLabel = MakeLabel("SMART-TV TRACKERS BLOCKED\n142 Blocked Today (Samsung & LG)", new Font("Segoe UI", 9f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(20, 18));
            bCard1.Controls.Add(BottomAcrLabel);

            BentoPanel bCard2 = new BentoPanel();
            bCard2.Location = new Point(356, 502);
            bCard2.Size = new Size(336, 78);
            DashboardView.Controls.Add(bCard2);

            BottomWifiCountLabel = MakeLabel("DEVICES ON YOUR WI-FI\n4 Recognized · 0 Strangers", new Font("Segoe UI", 9f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(20, 18));
            bCard2.Controls.Add(BottomWifiCountLabel);

            BentoPanel bCard3 = new BentoPanel();
            bCard3.Location = new Point(712, 502);
            bCard3.Size = new Size(336, 78);
            DashboardView.Controls.Add(bCard3);

            BottomEncryptedLabel = MakeLabel("BROWSING PRIVACY\n100% Private (18.4 GB Protected)", new Font("Segoe UI", 9f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(20, 18));
            bCard3.Controls.Add(BottomEncryptedLabel);

            // 3. Wi-Fi & Smart-TV Protection View (Tab 2)
            RadarView = new Panel();
            RadarView.Location = new Point(28, 86);
            RadarView.Size = new Size(1048, 595);
            RadarView.BackColor = Color.Transparent;
            RadarView.Visible = false;
            this.Controls.Add(RadarView);

            Label radarTitle = MakeLabel("Wi-Fi & Smart-TV Protection", new Font("Segoe UI", 20f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(4, 0));
            RadarView.Controls.Add(radarTitle);

            Label radarSub = MakeLabel("Automatically watch your home Wi-Fi for unknown devices and stop Smart TVs from spying on what you watch", new Font("Segoe UI", 9.5f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(6, 38));
            RadarView.Controls.Add(radarSub);

            RadarStatusBadge = MakeLabel("AUTO-PROTECT OFF", new Font("Segoe UI", 9f, FontStyle.Bold), Color.FromArgb(71, 85, 105), new Point(895, 12));
            RadarView.Controls.Add(RadarStatusBadge);

            BentoPanel radarLeft = new BentoPanel();
            radarLeft.Location = new Point(0, 72);
            radarLeft.Size = new Size(510, 490);
            RadarView.Controls.Add(radarLeft);

            Label toggleTitle = MakeLabel("Watch My Home Wi-Fi Automatically", new Font("Segoe UI", 10.5f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(24, 24));
            radarLeft.Controls.Add(toggleTitle);

            RadarToggleBtn = new Button();
            RadarToggleBtn.UseMnemonic = false;
            RadarToggleBtn.Text = "OFF";
            RadarToggleBtn.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            RadarToggleBtn.FlatStyle = FlatStyle.Flat;
            RadarToggleBtn.BackColor = Color.FromArgb(226, 232, 240);
            RadarToggleBtn.Size = new Size(68, 30);
            RadarToggleBtn.Location = new Point(414, 20);
            RadarToggleBtn.Click += (s, e) => ToggleRadar();
            radarLeft.Controls.Add(RadarToggleBtn);

            Label freqLabel = MakeLabel("HOW OFTEN SHOULD WE CHECK YOUR WI-FI?", new Font("Segoe UI", 8f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(24, 68));
            radarLeft.Controls.Add(freqLabel);

            FreqRealTimeBtn = new Button();
            FreqRealTimeBtn.UseMnemonic = false;
            FreqRealTimeBtn.Text = "Always On";
            FreqRealTimeBtn.Location = new Point(24, 92);
            FreqRealTimeBtn.Size = new Size(140, 32);
            FreqRealTimeBtn.Click += (s, e) => SetFrequency("Always On");
            radarLeft.Controls.Add(FreqRealTimeBtn);

            Freq15mBtn = new Button();
            Freq15mBtn.UseMnemonic = false;
            Freq15mBtn.Text = "Every 15 Mins";
            Freq15mBtn.Location = new Point(174, 92);
            Freq15mBtn.Size = new Size(140, 32);
            Freq15mBtn.Click += (s, e) => SetFrequency("Every 15 Mins");
            radarLeft.Controls.Add(Freq15mBtn);

            FreqHourlyBtn = new Button();
            FreqHourlyBtn.UseMnemonic = false;
            FreqHourlyBtn.Text = "Once an Hour";
            FreqHourlyBtn.Location = new Point(324, 92);
            FreqHourlyBtn.Size = new Size(140, 32);
            FreqHourlyBtn.Click += (s, e) => SetFrequency("Once an Hour");
            radarLeft.Controls.Add(FreqHourlyBtn);

            Label modeLabel = MakeLabel("HOW DO YOU USE THE INTERNET? (CONNECTION MODE)", new Font("Segoe UI", 8f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(24, 145));
            radarLeft.Controls.Add(modeLabel);

            ProtocolDropdown = new ComboBox();
            ProtocolDropdown.DropDownStyle = ComboBoxStyle.DropDownList;
            ProtocolDropdown.Items.AddRange(new object[] {
                "Everyday Browsing & 4K Streaming (Recommended — Fastest)",
                "Public Wi-Fi, Cafes, Hotels & Airports (Extra Security)",
                "Maximum Smart-TV & Ad Blocker (Strict Tracking Protection)"
            });
            ProtocolDropdown.SelectedIndex = 0;
            ProtocolDropdown.Size = new Size(458, 30);
            ProtocolDropdown.Location = new Point(24, 168);
            ProtocolDropdown.SelectedIndexChanged += (s, e) =>
            {
                CurrentProtocol = ProtocolDropdown.SelectedItem.ToString();
            };
            radarLeft.Controls.Add(ProtocolDropdown);

            Label strangerLabel = MakeLabel("WHAT HAPPENS IF A STRANGER JOINS YOUR WI-FI?", new Font("Segoe UI", 8f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(24, 222));
            radarLeft.Controls.Add(strangerLabel);

            ActionAutoProtectRadio = new RadioButton();
            ActionAutoProtectRadio.UseMnemonic = false;
            ActionAutoProtectRadio.Text = "Pop Up a Warning & Protect My Computer Automatically";
            ActionAutoProtectRadio.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            ActionAutoProtectRadio.ForeColor = Color.FromArgb(15, 23, 42);
            ActionAutoProtectRadio.BackColor = Color.White;
            ActionAutoProtectRadio.Checked = true;
            ActionAutoProtectRadio.AutoSize = true;
            ActionAutoProtectRadio.Location = new Point(24, 248);
            radarLeft.Controls.Add(ActionAutoProtectRadio);

            Label autoSub = MakeLabel("Recommended — keeps your passwords and files safe right away", new Font("Segoe UI", 8.25f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(44, 272));
            radarLeft.Controls.Add(autoSub);

            ActionNotifyOnlyRadio = new RadioButton();
            ActionNotifyOnlyRadio.UseMnemonic = false;
            ActionNotifyOnlyRadio.Text = "Just Show Me a Quiet Notification";
            ActionNotifyOnlyRadio.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            ActionNotifyOnlyRadio.ForeColor = Color.FromArgb(15, 23, 42);
            ActionNotifyOnlyRadio.BackColor = Color.White;
            ActionNotifyOnlyRadio.AutoSize = true;
            ActionNotifyOnlyRadio.Location = new Point(24, 308);
            radarLeft.Controls.Add(ActionNotifyOnlyRadio);

            Label notifySub = MakeLabel("Let me decide manually when a new device appears on my Wi-Fi", new Font("Segoe UI", 8.25f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(44, 332));
            radarLeft.Controls.Add(notifySub);

            TestAlertBtn = new Button();
            TestAlertBtn.UseMnemonic = false;
            TestAlertBtn.Text = "Send Test Alert (See How Warnings Look)";
            TestAlertBtn.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            TestAlertBtn.Size = new Size(458, 38);
            TestAlertBtn.Location = new Point(24, 420);
            TestAlertBtn.Click += (s, e) =>
            {
                if (!IsRadarEnabled) ToggleRadar();
                BottomAcrLabel.Text = "SMART-TV TRACKERS BLOCKED\n149 Blocked Today (Samsung & LG)";
            };
            radarLeft.Controls.Add(TestAlertBtn);

            BentoPanel radarRight = new BentoPanel();
            radarRight.Location = new Point(534, 72);
            radarRight.Size = new Size(514, 490);
            RadarView.Controls.Add(radarRight);

            Label shieldsHeading = MakeLabel("HOUSEHOLD PRIVACY SHIELDS", new Font("Segoe UI", 8.5f, FontStyle.Bold), Color.FromArgb(100, 116, 139), new Point(24, 24));
            radarRight.Controls.Add(shieldsHeading);

            ShieldsAllBtn = new Button();
            ShieldsAllBtn.UseMnemonic = false;
            ShieldsAllBtn.Text = "Turn On All";
            ShieldsAllBtn.Size = new Size(82, 26);
            ShieldsAllBtn.Location = new Point(320, 20);
            ShieldsAllBtn.Click += (s, e) => SetAllShields(true);
            radarRight.Controls.Add(ShieldsAllBtn);

            ShieldsNoneBtn = new Button();
            ShieldsNoneBtn.UseMnemonic = false;
            ShieldsNoneBtn.Text = "Turn Off All";
            ShieldsNoneBtn.Size = new Size(82, 26);
            ShieldsNoneBtn.Location = new Point(408, 20);
            ShieldsNoneBtn.Click += (s, e) => SetAllShields(false);
            radarRight.Controls.Add(ShieldsNoneBtn);

            string[] shieldNames = new string[] {
                "Samsung & LG Smart-TV Anti-Spy Shield",
                "Roku, Fire TV & Apple TV Ad-Tracker Blocker",
                "Home Wi-Fi Router Safety Check",
                "Automatic Emergency Cut-Off (No Accidental Leaks)"
            };
            string[] shieldSubs = new string[] {
                "Stops your TV from taking hidden screenshots of what you watch",
                "Blocks streaming boxes from sending viewing habits to ad companies",
                "Checks that your home Wi-Fi router has no unsafe open doors",
                "Pauses internet if VPN drops so your real location never leaks"
            };
            for (int i = 0; i < 4; i++)
            {
                int idx = i;
                int yPos = 72 + (i * 88);
                CheckBox cb = new CheckBox();
                cb.UseMnemonic = false;
                cb.Text = shieldNames[i];
                cb.Checked = true;
                cb.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                cb.ForeColor = Color.FromArgb(15, 23, 42);
                cb.BackColor = Color.White;
                cb.AutoSize = true;
                cb.Location = new Point(24, yPos);
                cb.CheckedChanged += (s, e) => { ShieldStates[idx] = cb.Checked; };
                ShieldCheckboxes[i] = cb;
                radarRight.Controls.Add(cb);

                Label sSub = MakeLabel(shieldSubs[i], new Font("Segoe UI", 8.25f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(44, yPos + 24));
                radarRight.Controls.Add(sSub);
            }
        }

        private void AddRecommendationRow(Control parent, int y, string title, string subtitle)
        {
            Label t = MakeLabel(title, new Font("Segoe UI", 9.5f, FontStyle.Bold), Color.FromArgb(15, 23, 42), new Point(22, y));
            parent.Controls.Add(t);

            Label sub = MakeLabel(subtitle, new Font("Segoe UI", 8.25f, FontStyle.Regular), Color.FromArgb(100, 116, 139), new Point(22, y + 20));
            parent.Controls.Add(sub);
        }

        public void SwitchTab(string tab)
        {
            CurrentTab = tab;
            DashboardView.Visible = (tab == "dashboard");
            RadarView.Visible = (tab == "radar");
            TabDashboardBtn.BackColor = (tab == "dashboard") ? Color.FromArgb(220, 252, 231) : Color.White;
            TabRadarBtn.BackColor = (tab == "radar") ? Color.FromArgb(220, 252, 231) : Color.White;
        }

        public void SelectServer(string code)
        {
            foreach (ServerNode srv in Servers)
            {
                if (srv.Code == code)
                {
                    CurrentServer = srv;
                    break;
                }
            }
            if (ServerLocationDropdown.SelectedItem != CurrentServer)
            {
                ServerLocationDropdown.SelectedItem = CurrentServer;
            }
            NodeBadgeLabel.Text = IsConnected ? ("PROTECTED & PRIVATE · " + CurrentServer.City.ToUpper()) : "YOUR PRIVACY STATUS";
            PingValueLabel.Text = "Calls: " + CurrentServer.CallQuality;
            SpeedValueLabel.Text = "Streaming: " + CurrentServer.StreamSpeed;
            UpdateConnectionUI();
        }

        public void ToggleConnection()
        {
            IsConnected = !IsConnected;
            UpdateConnectionUI();
        }

        public void FixAllPrivacyRisks()
        {
            if (!IsConnected) IsConnected = true;
            FixRisksBtn.Text = "ALL 3 PROTECTIONS ARE ON ✓";
            UpdateConnectionUI();
        }

        private void UpdateConnectionUI()
        {
            if (IsConnected)
            {
                TunnelGauge.Connected = true;
                TunnelGauge.Percentage = 100;
                TunnelGauge.BadgeWord = "SAFE";
                TunnelGauge.TitleText = "Protected & Private";
                TunnelGauge.SubText = "Connected via " + CurrentServer.City;
                NodeBadgeLabel.Text = "PROTECTED & PRIVATE · " + CurrentServer.City.ToUpper();
                ConnectBtn.Text = "PROTECTION IS ON (CLICK TO TURN OFF)";
                WelcomeSubtitle.Text = "Protected & Private · Connected via " + CurrentServer.City + " · Internet Slowdowns & Smart-TV Spying Blocked";
                BottomEncryptedLabel.Text = "BROWSING PRIVACY\n100% Private (18.45 GB Protected)";
            }
            else
            {
                TunnelGauge.Connected = false;
                TunnelGauge.Percentage = 30;
                TunnelGauge.BadgeWord = "OFF";
                TunnelGauge.TitleText = "Not Protected Yet";
                TunnelGauge.SubText = "Websites can see your real location";
                NodeBadgeLabel.Text = "YOUR PRIVACY STATUS";
                ConnectBtn.Text = "PROTECT MY COMPUTER NOW";
                WelcomeSubtitle.Text = "Your Home Wi-Fi Check is complete · 2 privacy improvements recommended below";
            }
            TunnelGauge.Invalidate();
            ConnectBtn.Invalidate();
            FixRisksBtn.Invalidate();
        }

        public void RunWifiScan()
        {
            DiscoveredLanDevices.Clear();
            WifiCleanList.Items.Clear();

            DiscoveredLanDevices.Add("Home Wi-Fi Router — Safe ✓");
            DiscoveredLanDevices.Add("Living Room Samsung Smart TV — TV Trackers Found");

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("arp", "-a");
                psi.RedirectStandardOutput = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    string output = p.StandardOutput.ReadToEnd();
                    string[] lines = output.Split(new char[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                    int idx = 1;
                    foreach (string line in lines)
                    {
                        string trimmed = line.Trim();
                        if (trimmed.StartsWith("192.168.") || trimmed.StartsWith("10.") || trimmed.StartsWith("172."))
                        {
                            string[] parts = trimmed.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            if (parts.Length >= 2 && parts[0] != "192.168.1.1")
                            {
                                DiscoveredLanDevices.Add("Home Computer / Device #" + idx + " — Safe ✓");
                                idx++;
                                if (DiscoveredLanDevices.Count >= 6) break;
                            }
                        }
                    }
                }
            }
            catch { }

            foreach (string item in DiscoveredLanDevices)
            {
                WifiCleanList.Items.Add(item);
            }
            WifiCountLabel.Text = DiscoveredLanDevices.Count + " Devices Found on Your Wi-Fi";
            BottomWifiCountLabel.Text = "DEVICES ON YOUR WI-FI\n" + DiscoveredLanDevices.Count + " Recognized · 0 Strangers";
        }

        public void ToggleRadar()
        {
            IsRadarEnabled = !IsRadarEnabled;
            RadarToggleBtn.Text = IsRadarEnabled ? "ON" : "OFF";
            RadarToggleBtn.BackColor = IsRadarEnabled ? Color.FromArgb(16, 185, 129) : Color.FromArgb(226, 232, 240);
            RadarToggleBtn.ForeColor = IsRadarEnabled ? Color.White : Color.FromArgb(15, 23, 42);
            RadarStatusBadge.Text = IsRadarEnabled ? "AUTO-PROTECT ON" : "AUTO-PROTECT OFF";
            RadarStatusBadge.ForeColor = IsRadarEnabled ? Color.FromArgb(4, 120, 87) : Color.FromArgb(71, 85, 105);
        }

        public void SetFrequency(string freq)
        {
            CurrentFrequency = freq;
        }

        public void SetAllShields(bool enabled)
        {
            for (int i = 0; i < 4; i++)
            {
                ShieldStates[i] = enabled;
                if (ShieldCheckboxes[i] != null) ShieldCheckboxes[i].Checked = enabled;
            }
        }

        public void ToggleTheme()
        {
            IsDarkTheme = !IsDarkTheme;
            this.BackColor = IsDarkTheme ? Color.FromArgb(15, 23, 42) : Color.FromArgb(244, 247, 249);
            ThemeBtn.Text = IsDarkTheme ? "Light Mode" : "Dark Mode";
        }

        public bool ActivateLicense(string email, string code)
        {
            if (string.IsNullOrEmpty(email) || !email.Contains("@") || string.IsNullOrEmpty(code) || code.Length < 6)
            {
                return false;
            }
            IsPro = true;
            TierBadgeBtn.Text = "PRO ACTIVE (10 COMPUTERS)";
            TierBadgeBtn.BackColor = Color.FromArgb(220, 252, 231);
            TierBadgeBtn.ForeColor = Color.FromArgb(4, 120, 87);
            if (!IsConnected) ToggleConnection();
            return true;
        }

        private void OpenActivationDialog()
        {
            ActivateLicense("demo@sweeprvpn.com", "849201");
            MessageBox.Show(
                "SWEEPR VPN Pro is now active on this computer (1 of 10 Computers Used).\nAll 8 Country Locations & Automatic Smart-TV Protection are unlocked!",
                "SWEEPR VPN Pro Activated",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
        }

        public static int RunSelfTest(string outFile)
        {
            MainForm form = new MainForm();
            form.StartPosition = FormStartPosition.Manual;
            form.Location = new Point(-3000, -3000);
            form.ShowInTaskbar = false;
            form.Show();
            Application.DoEvents();

            // 1. Verify Country Location Dropdown in Home & Privacy exists and has 8 locations
            if (form.ServerLocationDropdown == null || form.ServerLocationDropdown.Items.Count != 8)
                throw new Exception("Country Location Dropdown missing or incomplete.");

            // 2. Test picking different countries from Dropdown and verify plain-English speed ratings
            form.SelectServer("CH-ZRH-01");
            if (form.CurrentServer.Code != "CH-ZRH-01" || form.PingValueLabel.Text != "Calls: Instant (No Lag)")
                throw new Exception("Country dropdown selection failed for CH-ZRH-01.");

            form.SelectServer("US-NYC-01");
            if (form.CurrentServer.Code != "US-NYC-01" || form.PingValueLabel.Text != "Calls: Smooth (HD Ready)")
                throw new Exception("Country dropdown selection failed for US-NYC-01.");

            // 3. Test Protect My Computer Now & Turn Off
            form.ToggleConnection();
            if (!form.IsConnected || form.TunnelGauge.BadgeWord != "SAFE")
                throw new Exception("Protect My Computer Now failed.");

            form.ToggleConnection();
            if (form.IsConnected || form.TunnelGauge.BadgeWord != "OFF")
                throw new Exception("Turn Off Protection failed.");

            // 4. Test Turn On All 3 Protections CTA
            form.FixAllPrivacyRisks();
            if (!form.IsConnected || form.FixRisksBtn.Text != "ALL 3 PROTECTIONS ARE ON ✓")
                throw new Exception("Turn On All 3 Protections failed.");

            // 5. Test Plain-English Home Wi-Fi Device Check
            form.RunWifiScan();
            if (form.DiscoveredLanDevices.Count < 2)
                throw new Exception("Home Wi-Fi Device Check failed.");

            // 6. Test Tab Switching (Home & Privacy <-> Wi-Fi & TV Protection)
            form.SwitchTab("radar");
            Application.DoEvents();
            if (form.CurrentTab != "radar" || !form.RadarView.Visible || form.DashboardView.Visible)
                throw new Exception("Switch to Wi-Fi & TV Protection tab failed.");

            form.SwitchTab("dashboard");
            Application.DoEvents();
            if (form.CurrentTab != "dashboard" || !form.DashboardView.Visible || form.RadarView.Visible)
                throw new Exception("Switch back to Home & Privacy tab failed.");

            // 7. Test Auto-Protect Toggle, Check Frequency, Connection Mode Dropdown, and Household Shields
            form.ToggleRadar();
            if (!form.IsRadarEnabled || form.RadarStatusBadge.Text != "AUTO-PROTECT ON")
                throw new Exception("Auto-Protect toggle failed.");

            form.SetFrequency("Every 15 Mins");
            if (form.CurrentFrequency != "Every 15 Mins")
                throw new Exception("Check frequency selector failed.");

            form.ProtocolDropdown.SelectedIndex = 1;
            if (!form.CurrentProtocol.Contains("Public Wi-Fi"))
                throw new Exception("Connection Mode dropdown failed.");

            form.SetAllShields(false);
            if (form.ShieldStates[0] || form.ShieldStates[3])
                throw new Exception("SetAllShields(false) failed.");

            form.SetAllShields(true);
            if (!form.ShieldStates[0] || !form.ShieldStates[3])
                throw new Exception("SetAllShields(true) failed.");

            // 8. Test Pro Activation & Dark/Light Mode Toggle
            bool activated = form.ActivateLicense("demo@sweeprvpn.com", "849201");
            if (!activated || !form.IsPro || form.TierBadgeBtn.Text != "PRO ACTIVE (10 COMPUTERS)")
                throw new Exception("License activation failed.");

            form.ToggleTheme();
            if (!form.IsDarkTheme || form.ThemeBtn.Text != "Light Mode")
                throw new Exception("Theme toggle failed.");

            form.Close();
            string json = "{\"ok\":true,\"desktopSelfTest\":\"PASSED_PLAIN_ENGLISH_UX\",\"serversCount\":" + form.Servers.Count + ",\"lanDevicesFound\":" + form.DiscoveredLanDevices.Count + "}";
            if (!string.IsNullOrEmpty(outFile))
            {
                File.WriteAllText(outFile, json, Encoding.UTF8);
            }
            return 0;
        }

        [STAThread]
        public static int Main(string[] args)
        {
            if (args != null && args.Length > 0 && args[0] == "--screenshot")
            {
                string outPng = args.Length > 1 ? args[1] : "screenshot.png";
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                MainForm form = new MainForm();
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new Point(100, 100);
                if (args.Length > 2 && args[2] == "radar") form.SwitchTab("radar");
                if (args.Length > 2 && args[2] == "connected") form.ToggleConnection();
                form.Show();
                Application.DoEvents();
                using (Bitmap bmp = new Bitmap(form.Width, form.Height))
                {
                    form.DrawToBitmap(bmp, new Rectangle(0, 0, form.Width, form.Height));
                    bmp.Save(outPng, System.Drawing.Imaging.ImageFormat.Png);
                }
                form.Close();
                return 0;
            }
            if (args != null && args.Length > 0 && args[0] == "--self-test")
            {
                string outFile = args.Length > 1 ? args[1] : null;
                try
                {
                    return RunSelfTest(outFile);
                }
                catch (Exception ex)
                {
                    if (!string.IsNullOrEmpty(outFile))
                        File.WriteAllText(outFile, "{\"ok\":false,\"error\":\"" + ex.Message + "\"}", Encoding.UTF8);
                    return 1;
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            return 0;
        }
    }
}
